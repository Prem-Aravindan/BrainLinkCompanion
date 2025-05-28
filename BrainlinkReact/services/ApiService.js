import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants';

class ApiService {
  constructor() {
    this.baseUrl = null;
    this.token = null;
  }

  /**
   * Set the API base URL based on environment
   */
  setEnvironment(environment) {
    this.baseUrl = API_CONFIG.ENDPOINTS[environment];
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Get stored authentication token
   */
  async getStoredToken() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        this.token = token;
      }
      return token;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  /**
   * Store authentication token
   */
  async storeToken(token) {
    try {
      await AsyncStorage.setItem('auth_token', token);
      this.token = token;
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  /**
   * Remove stored authentication token
   */
  async removeToken() {
    try {
      await AsyncStorage.removeItem('auth_token');
      this.token = null;
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }

  /**
   * Make HTTP request with proper headers
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.baseUrl) {
      throw new Error('API environment not set. Call setEnvironment() first.');
    }

    const url = `${this.baseUrl}${endpoint}`;    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      defaultHeaders['X-Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      headers: defaultHeaders,
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };    try {
      console.log('Making request to:', url);
      console.log('Request method:', config.method || 'GET');
      console.log('Request headers:', config.headers);
      console.log('Request body:', config.body);
      
      const response = await fetch(url, config);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      // Try to parse JSON response
      let data;
      try {
        const text = await response.text();
        console.log('Response text:', text);
        data = text ? JSON.parse(text) : {};
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }  /**
   * Login user with username and password
   */
  async login(username, password) {
    try {
      console.log('🔐 Attempting login...');
      const response = await this.makeRequest('/token/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
        }),
      });

      console.log('✅ Login response received:', response);

      // Extract JWT token from response (matches Python: data.get("x-jwt-access-token"))
      if (response['x-jwt-access-token']) {
        await this.storeToken(response['x-jwt-access-token']);
        this.setToken(response['x-jwt-access-token']);
        console.log('🎫 JWT token stored successfully');
      } else {
        console.warn('⚠️ No x-jwt-access-token in response:', Object.keys(response));
      }

      return {
        success: true,
        user: response.user,
        token: response['x-jwt-access-token'],
        response: response, // Include full response for debugging
      };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Logout user
   */
//   async logout() {
//     try {
//       // Call logout endpoint if available
//       if (this.token) {
//         await this.makeRequest('/auth/logout', {
//           method: 'POST',
//         });
//       }
//     } catch (error) {
//       console.error('Logout API call failed:', error);
//     } finally {
//       // Always remove local token
//       await this.removeToken();
//     }
//   }

  /**
   * Validate current session
   */
//   async validateSession() {
//     try {
//       const token = await this.getStoredToken();
//       if (!token) {
//         return { valid: false };
//       }

//       const response = await this.makeRequest('/auth/validate', {
//         method: 'GET',
//       });

//       return {
//         valid: true,
//         user: response.user,
//       };
//     } catch (error) {
//       // Token is invalid, remove it
//       await this.removeToken();
//       return {
//         valid: false,
//         error: error.message,
//       };
//     }
//   }

  /**
   * Get user's authorized HWIDs
   */
  async getUserHWIDs(userId) {
    try {
      const response = await this.makeRequest(`/users/hwids`, {
        method: 'GET',
      });

      return {
        success: true,
        hwids: response.hwids || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        hwids: [],
      };
    }
  }

  /**
   * Validate device HWID for current user
   */
//   async validateHWID(hwid) {
//     try {
//       const response = await this.makeRequest('/devices/validate', {
//         method: 'POST',
//         body: JSON.stringify({
//           hwid,
//         }),
//       });

//       return {
//         success: true,
//         valid: response.valid,
//         device: response.device,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         valid: false,
//         error: error.message,
//       };
//     }
//   }

  /**
   * Register a new device HWID
   */
//   async registerDevice(hwid, deviceName) {
//     try {
//       const response = await this.makeRequest('/devices/register', {
//         method: 'POST',
//         body: JSON.stringify({
//           hwid,
//           device_name: deviceName,
//         }),
//       });

//       return {
//         success: true,
//         device: response.device,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         error: error.message,
//       };
//     }
//   }

  /**
   * Get device information by HWID
   */
//   async getDeviceInfo(hwid) {
//     try {
//       const response = await this.makeRequest(`/devices/${hwid}`, {
//         method: 'GET',
//       });

//       return {
//         success: true,
//         device: response.device,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         error: error.message,
//       };
//     }
//   }

  /**
   * Update user profile
   */
//   async updateProfile(profileData) {
//     try {
//       const response = await this.makeRequest('/users/profile', {
//         method: 'PUT',
//         body: JSON.stringify(profileData),
//       });

//       return {
//         success: true,
//         user: response.user,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         error: error.message,
//       };
//     }
//   }

  /**
   * Get user statistics
   */
//   async getUserStats() {
//     try {
//       const response = await this.makeRequest('/users/stats', {
//         method: 'GET',
//       });

//       return {
//         success: true,
//         stats: response.stats,
//       };
//     } catch (error) {
//       return {
//         success: false,
//         error: error.message,
//       };
//     }
//   }

  /**
   * Upload EEG session data
   */
  async uploadSessionData(sessionData) {
    try {
      const response = await this.makeRequest('/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });

      return {
        success: true,
        session: response.session,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's session history
   */
  async getSessionHistory(limit = 10, offset = 0) {
    try {
      const response = await this.makeRequest(
        `/sessions?limit=${limit}&offset=${offset}`, 
        {
          method: 'GET',
        }
      );

      return {
        success: true,
        sessions: response.sessions,
        total: response.total,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sessions: [],
      };
    }
  }
  /**
   * Get user's authorized BrainLink devices/HWIDs (matches Python: /users/hwids)
   */
  async getUserDevices() {
    try {
      const response = await this.makeRequest('/users/hwids', {
        method: 'GET',
      });

      // Handle both string and array formats (matches Python normalization)
      const rawHwids = response.brainlink_hwid || [];
      let hwids = [];
      if (typeof rawHwids === 'string') {
        hwids = [rawHwids];
      } else if (Array.isArray(rawHwids)) {
        hwids = rawHwids;
      }

      return {
        success: true,
        devices: hwids,
        hwids: hwids, // Keep both for compatibility
      };
    } catch (error) {
      return {
        success: false,
        devices: [],
        hwids: [],
        error: error.message,
      };
    }
  }

  /**
   * Send EEG band power data (matches Python implementation)
   */
  async sendEEGData(bandPowers) {
    try {
      // Construct payload matching Python format
      const payload = {
        'Delta power': bandPowers.delta || 0,
        'Relative Delta': bandPowers.relativeDelta || 0,
        'Theta power': bandPowers.theta || 0,
        'Relative Theta': bandPowers.relativeTheta || 0,
        'Alpha power': bandPowers.alpha || 0,
        'Relative Alpha': bandPowers.relativeAlpha || 0,
        'Beta power': bandPowers.beta || 0,
        'Relative Beta': bandPowers.relativeBeta || 0,
        'Gamma power': bandPowers.gamma || 0,
        'Relative Gamma': bandPowers.relativeGamma || 0,
      };

      const response = await this.makeRequest('/brainlink_data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        response: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
