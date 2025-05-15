import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';

const supabaseUrl = 'https://ddtgdhehxhgarkonvpfq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY';

// Offline cache helpers
const offlineCache = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(`offline_cache_${key}`);
      if (cached) {
        const { data, expiry } = JSON.parse(cached);
        // Check if cache is expired
        if (expiry > Date.now()) {
          console.log('Using cached data for:', key);
          return data;
        } else {
          // Remove expired cache
          await AsyncStorage.removeItem(`offline_cache_${key}`);
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    return null;
  },
  
  async set(key, data, ttlMinutes = 60) {
    try {
      const cacheData = {
        data,
        expiry: Date.now() + (ttlMinutes * 60 * 1000)
      };
      await AsyncStorage.setItem(`offline_cache_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  },
  
  createCacheKey(url, options) {
    const bodyString = options.body ? JSON.stringify(options.body) : '';
    return `${options.method || 'GET'}_${url}_${bodyString}`;
  }
};

// Function to retry network requests
const fetchWithRetry = async (url, options, maxRetries = 3, timeout = 20000) => {
    let retries = 0;
    let netInfoState = await NetInfo.fetch();
    
    // If offline and this is a GET request, try to use cache
    if (!netInfoState.isConnected && (!options.method || options.method === 'GET')) {
      try {
        const cacheKey = offlineCache.createCacheKey(url, options);
        const cachedData = await offlineCache.get(cacheKey);
        if (cachedData) {
          // Create a mock response from cache
          return new Response(JSON.stringify(cachedData), {
            status: 200,
            headers: new Headers({
              'Content-Type': 'application/json',
              'X-Offline-Cache': 'true'
            })
          });
        }
      } catch (cacheError) {
        console.error('Error using offline cache:', cacheError);
      }
    }
    
    // Create a function for the actual fetch with timeout
    const attemptFetch = () => {
        const controller = new AbortController();
        const { signal } = controller;
        
        // Add signal to request options
        const enhancedOptions = {
            ...options,
            signal,
        };
        
        // Create a timeout that will abort the request
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('Request timed out:', url);
        }, timeout);
        
        return new Promise((resolve, reject) => {
            fetch(url, enhancedOptions)
                .then(response => {
                    clearTimeout(timeoutId);
                    
                    // If this is a GET request and successful, cache the response
                    if ((!options.method || options.method === 'GET') && response.ok) {
                      // Clone the response before consuming it
                      const clonedResponse = response.clone();
                      clonedResponse.json().then(data => {
                        const cacheKey = offlineCache.createCacheKey(url, options);
                        offlineCache.set(cacheKey, data);
                      }).catch(err => {
                        console.error('Error caching response:', err);
                      });
                    }
                    
                    resolve(response);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    };
    
    // Try the fetch, with retries on failure
    while (retries < maxRetries) {
        try {
            // First check network status
            netInfoState = await NetInfo.fetch();
            if (!netInfoState.isConnected) {
                console.log('No internet connection');
                
                // If this is a GET request, try to return from cache
                if (!options.method || options.method === 'GET') {
                  try {
                    const cacheKey = offlineCache.createCacheKey(url, options);
                    const cachedData = await offlineCache.get(cacheKey);
                    if (cachedData) {
                      console.log('Returning cached data for:', cacheKey);
                      return new Response(JSON.stringify(cachedData), {
                        status: 200,
                        headers: new Headers({
                          'Content-Type': 'application/json',
                          'X-Offline-Cache': 'true'
                        })
                      });
                    }
                  } catch (cacheError) {
                    console.error('Error getting from cache:', cacheError);
                  }
                }
                
                throw new Error('No internet connection');
            }
            
            return await attemptFetch();
        } catch (error) {
            retries++;
            console.log(`Attempt ${retries}/${maxRetries} failed:`, error.message);
            
            if (retries >= maxRetries) {
                throw error;
            }
            
            // Wait before retrying - exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
        }
    }
};

// Configure Supabase client with better network handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
    global: {
        headers: {
            'X-Client-Info': 'MatrixAI-Mobile-App'
        },
        // Use our custom fetch implementation with retry logic
        fetch: (url, options) => fetchWithRetry(url, options)
    },
});

// Add this helper function to check auth state
export const checkUser = async () => {
    try {
        // First check if we're online
        const netInfoState = await NetInfo.fetch();
        if (!netInfoState.isConnected) {
            // If offline, check local storage
            const storedUid = await AsyncStorage.getItem('uid');
            const userLoggedIn = await AsyncStorage.getItem('userLoggedIn');
            
            if (storedUid && userLoggedIn === 'true') {
                console.log('Offline mode: Using stored user ID');
                return { id: storedUid, isOffline: true };
            }
            return null;
        }
        
        // If online, use Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user) {
            await AsyncStorage.setItem('uid', session.user.id);
            return session.user;
        }
        return null;
    } catch (error) {
        console.error('Error checking user:', error.message);
        return null;
    }
};