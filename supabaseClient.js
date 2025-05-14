import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';

const supabaseUrl = 'https://ddtgdhehxhgarkonvpfq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY';

// Function to retry network requests
const fetchWithRetry = async (url, options, maxRetries = 3, timeout = 20000) => {
    let retries = 0;
    
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
            const state = await NetInfo.fetch();
            if (!state.isConnected) {
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