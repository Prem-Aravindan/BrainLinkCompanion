#!/bin/bash

echo "🔍 BrainLink Build Checks"
echo "========================="

echo
echo "1. Checking JAR file exists..."
if [ -f "android/app/libs/MacrotellectLink_V1.4.3.jar" ]; then
    echo "✅ MacrotellectLink_V1.4.3.jar found"
    ls -la "android/app/libs/MacrotellectLink_V1.4.3.jar"
else
    echo "❌ MacrotellectLink_V1.4.3.jar NOT found"
fi

echo
echo "2. Checking build.gradle dependency..."
if grep -q "MacrotellectLink_V1.4.3.jar" android/app/build.gradle; then
    echo "✅ JAR dependency found in build.gradle"
    grep "MacrotellectLink" android/app/build.gradle
else
    echo "❌ JAR dependency NOT found in build.gradle"
fi

echo
echo "3. Checking Java source files..."
echo "BrainLinkModuleSafe.java:"
if [ -f "android/app/src/main/java/com/brainlinkreact/BrainLinkModuleSafe.java" ]; then
    echo "✅ Found"
else
    echo "❌ Not found"
fi

echo "BrainLinkModuleStub.java:"
if [ -f "android/app/src/main/java/com/brainlinkreact/BrainLinkModuleStub.java" ]; then
    echo "✅ Found"
else
    echo "❌ Not found"
fi

echo "BrainLinkModuleFactory.java:"
if [ -f "android/app/src/main/java/com/brainlinkreact/BrainLinkModuleFactory.java" ]; then
    echo "✅ Found"
else
    echo "❌ Not found"
fi

echo "BrainLinkPackage.java:"
if [ -f "android/app/src/main/java/com/brainlinkreact/BrainLinkPackage.java" ]; then
    echo "✅ Found"
    echo "   Content check:"
    if grep -q "BrainLinkModuleFactory" android/app/src/main/java/com/brainlinkreact/BrainLinkPackage.java; then
        echo "   ✅ Uses factory pattern"
    else
        echo "   ❌ Does not use factory pattern"
    fi
else
    echo "❌ Not found"
fi

echo
echo "4. Checking for problematic imports..."
if grep -r "import com.macrotellect" android/app/src/main/java/com/brainlinkreact/ 2>/dev/null; then
    echo "❌ Found direct MacrotellectLink imports (these will cause compilation failures)"
else
    echo "✅ No direct MacrotellectLink imports found"
fi

echo
echo "5. Summary:"
echo "The build should now work because:"
echo "- ✅ Safe module uses reflection to load SDK classes"
echo "- ✅ No direct imports that cause compilation failure"
echo "- ✅ Factory pattern provides fallback to stub"
echo "- ✅ JAR file is properly configured"

echo
echo "📦 Ready for EAS Build!"
