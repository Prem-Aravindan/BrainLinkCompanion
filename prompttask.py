import asyncio
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import logging
import pandas as pd
import os
import sys, asyncio
# Configure logging
logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)
# --- Set your Google API credentials ---
API_KEY = "AIzaSyDO9QZHE4e97Xk3kmHQO_To_n01qBuuJWg"
CX = "0440fd8d8d4e745fd"
EXCLUDED_DOMAINS = [
     "reddit.com", "quora.com",
     "medium.com",
    "imdb.com", "bbc.com", "cnn.com", "nytimes.com"
]
def is_excluded(link):
    domain = urlparse(link).netloc.lower()
    return any(excl in domain for excl in EXCLUDED_DOMAINS)
async def fetch_url(session, url, params):
    async with session.get(url, params=params) as response:
        if response.status != 200:
            LOGGER.error(f"Error: {response.status}, {await response.text()}")
        return await response.json()
async def fetch_favicon_and_title(session, url, attempts=2):
    headers = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/98.0.4758.102 Safari/537.36")
    }
    for attempt in range(attempts):
        try:
            async with session.get(url, timeout=5, headers=headers) as response:
                response.raise_for_status()
                html_content = await response.text()
                soup = BeautifulSoup(html_content, "html.parser")
                title = ""
                if soup.find("title") and soup.find("title").text.strip():
                    title = soup.find("title").text.strip()
                if not title:
                    meta_og = soup.find("meta", property="og:title")
                    if meta_og and meta_og.get("content"):
                        title = meta_og.get("content").strip()
                if not title:
                    meta_tw = soup.find("meta", attrs={"name": "twitter:title"})
                    if meta_tw and meta_tw.get("content"):
                        title = meta_tw.get("content").strip()
                if title:
                    icon_link = soup.find("link", rel="icon") or soup.find("link", rel="shortcut icon")
                    if icon_link and icon_link.get("href"):
                        favicon_url = icon_link["href"]
                        if favicon_url.startswith("data:"):
                            return favicon_url, title
                        if favicon_url.startswith("//"):
                            return f"https:{favicon_url}", title
                        if favicon_url.startswith("http"):
                            return favicon_url, title
                        elif favicon_url.startswith("/"):
                            parsed = urlparse(url)
                            return f"{parsed.scheme}://{parsed.netloc}{favicon_url}", title
                        else:
                            return f"{url.rstrip('/')}/{favicon_url}", title
                    return f"{url.rstrip('/')}/favicon.ico", title
        except Exception as e:
            LOGGER.error("Attempt %d: Error fetching favicon and title for %s: %s", attempt + 1, url, e)
    parsed = urlparse(url)
    fallback_favicon = f"https://www.google.com/s2/favicons?domain={parsed.netloc}"
    fallback_title = parsed.netloc
    return fallback_favicon, fallback_title
async def find_websites_and_favicons_for_words(words, category, language):
    results = {}
    seen_websites = set()
    async with aiohttp.ClientSession() as session:
        tasks = []
        for word in words:
            url = "https://www.googleapis.com/customsearch/v1"
            if language.lower() == "nl":
                site_filter = 'site:.be OR site:.nl'
                cr_filter = 'countryBE'
                query = (f"{word} {category} website van het merk {site_filter} "
                         "-site:wikipedia.org -site:reddit.com -site:quora.com -site:linkedin.com -site:facebook.com "
                         "-site:twitter.com -site:instagram.com -site:pinterest.com -site:tumblr.com -site:medium.com "
                         "-site:youtube.com -site:imdb.com -site:bbc.com -site:cnn.com -site:nytimes.com")
                params = {
                    "key": API_KEY,
                    "cx": CX,
                    "q": query,
                    "num": 3,
                    "cr": cr_filter
                }
            else:
                query = (f"{word} {category} brand advertising "
                         "-site:wikipedia.org -site:reddit.com -site:quora.com -site:medium.com "
                         " -site:imdb.com ")
                params = {
                    "key": API_KEY,
                    "cx": CX,
                    "q": query,
                    "num": 3
                }
            tasks.append(fetch_url(session, url, params))
        responses = await asyncio.gather(*tasks)
        favicon_tasks = []
        for word, response in zip(words, responses):
            if response:
                try:
                    unique_found = False
                    for idx, item in enumerate(response.get("items", [])):
                        link = item.get("link", "")
                        if not link or is_excluded(link) or link in seen_websites:
                            continue
                        favicon_tasks.append(fetch_favicon_and_title(session, link))
                        results[word] = {"website": link, "favicon": None, "title": None}
                        seen_websites.add(link)
                        unique_found = True
                        break
                    if not unique_found:
                        for item in response.get("items", []):
                            link = item.get("link", "")
                            if link and not is_excluded(link) and link not in seen_websites:
                                favicon_tasks.append(fetch_favicon_and_title(session, link))
                                results[word] = {"website": link, "favicon": None, "title": None}
                                seen_websites.add(link)
                                break
                        else:
                            results[word] = {"website": "No valid website found", "favicon": "No favicon", "title": "No title"}
                except Exception as e:
                    results[word] = {"website": "No website found", "favicon": "No favicon", "title": "No title"}
            else:
                results[word] = {"website": "Error fetching data", "favicon": "No favicon", "title": "No title"}
        favicons_and_titles = await asyncio.gather(*favicon_tasks)
        for (word, info), (favicon, title) in zip(results.items(), favicons_and_titles):
            info["favicon"] = favicon
            info["title"] = title
    await asyncio.sleep(0)
    return results
def main():
    print("Google Custom Search Prompt Research Tool")
    print("------------------------------------------")
    language = input("Enter language code (e.g., en, nl) [default: en]: ").strip().lower() or "en"
    category = input("Enter a category (prompt) for your search [default: brand]: ").strip() or "brand"
    words_input = input("Enter words separated by commas [default: example, brand, research]: ").strip()
    words = [w.strip() for w in words_input.split(",")] if words_input else ["example", "brand", "research"]
    # Prompt user for the Excel file name before starting the search
    excel_filename = input("Enter the name for the output Excel file (e.g., results.xlsx): ").strip()
    if not excel_filename:
        excel_filename = "results.csv"
    print(f"\nRunning search for category: '{category}' with language: '{language}'\n")
    results = asyncio.run(find_websites_and_favicons_for_words(words, category, language))
    print("Results:")
    data = []
    for word, info in results.items():
        print(f"Word: {word}")
        print(f"  Website: {info['website']}")
        print(f"  Favicon: {info['favicon']}")
        print(f"  Title:   {info['title']}\n")
        data.append({
            "Word": word,
            "Website": info["website"],
            "Favicon": info["favicon"],
            "Title": info["title"]
        })
    # Save the results in an Excel file using pandas
    df = pd.DataFrame(data)
    ext = os.path.splitext(excel_filename)[1].lower()
    if ext == ".csv":
        df.to_csv(excel_filename, index=False)
        print(f"Results successfully saved to {excel_filename} as CSV.")
    else:
        # Default to Excel. Make sure you have openpyxl installed if using .xlsx.
        df.to_excel(excel_filename, index=False)
        print(f"Results successfully saved to {excel_filename} as Excel.")
    print("\nYou can refine your prompt and try again.\n")
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
if __name__ == "__main__":
    main()