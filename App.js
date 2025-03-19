import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ProStatusProvider } from './hooks/useProStatus';
// Import your navigation stack
// import MainNavigator from './navigation/MainNavigator';

const App = () => {
  return (
    <ProStatusProvider>
      <NavigationContainer>
        {/* Your main navigator/stack goes here */}
        {/* <MainNavigator /> */}
      </NavigationContainer>
    </ProStatusProvider>
  );
};

export default App; 