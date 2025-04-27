import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';

const supabaseUrl = 'https://ddtgdhehxhgarkonvpfq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY';

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
        // Add fetch options for better timeout handling
        fetch: (url, options) => {
            const controller = new AbortController();
            const { signal } = controller;
            
            // Create a timeout that will abort the request
            const timeout = setTimeout(() => {
                controller.abort();
                console.log('Request timed out:', url);
            }, 15000); // 15 second timeout
            
            // Add signal to request options
            const enhancedOptions = {
                ...options,
                signal,
            };
            
            return new Promise((resolve, reject) => {
                // First check network status
                NetInfo.fetch().then(state => {
                    if (!state.isConnected) {
                        clearTimeout(timeout);
                        reject(new Error('No internet connection'));
                        return;
                    }
                    
                    // Proceed with the fetch if connected
                    fetch(url, enhancedOptions)
                        .then(response => {
                            clearTimeout(timeout);
                            resolve(response);
                        })
                        .catch(error => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                });
            });
        }
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