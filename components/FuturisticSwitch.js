import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { ThemedText } from './ThemedView';
import Ionicons from 'react-native-vector-icons/Ionicons';

const FuturisticSwitch = ({ value, onValueChange, colors }) => {
  // Animation values
  const translateX = new Animated.Value(value ? 1 : 0);
  const bgInterpolation = new Animated.Value(value ? 1 : 0);
  const glowAnimation = new Animated.Value(0);
  const pulseAnimation = new Animated.Value(0);
  
  // Run animation when value changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: value ? 1 : 0,
        duration: 350,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: false,
      }),
      Animated.timing(bgInterpolation, {
        toValue: value ? 1 : 0,
        duration: 350,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: false,
      }),
    ]).start();

    // Glow effect animation
    if (value) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnimation, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnimation, {
            toValue: 0.5,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
      
      // Pulse animation for the label
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 0.7,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      glowAnimation.setValue(0);
      pulseAnimation.setValue(0.7);
    }
  }, [value]);

  // Interpolate position and background color
  const position = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 36],
  });

  const backgroundColor = bgInterpolation.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.background2, colors.primary],
  });

  const borderColor = bgInterpolation.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.3, 0],
  });
  
  const labelOpacity = pulseAnimation.interpolate({
    inputRange: [0.7, 1],
    outputRange: [0.7, 1],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.labelContainer, { opacity: labelOpacity }]}>
        <ThemedText style={[styles.modeLabel, { color: value ? colors.primary : colors.text + '80' }]}>
          {value ? 'DARK' : 'LIGHT'}
        </ThemedText>
      </Animated.View>
      
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => onValueChange(!value)}
        style={styles.touchableArea}
      >
        <Animated.View 
          style={[
            styles.track,
            { 
              backgroundColor,
              borderColor,
            }
          ]}
        >
          {/* Small power indicator */}
          <View style={styles.powerIndicator}>
            <Animated.View 
              style={[
                styles.powerDot,
                { 
                  backgroundColor: value ? colors.primary : colors.text + '40',
                  opacity: value ? 1 : 0.5,
                }
              ]} 
            />
          </View>
          
          {/* Animated dot/thumb */}
          <Animated.View 
            style={[
              styles.thumb,
              { 
                transform: [{ translateX: position }],
                backgroundColor: value ? '#FFFFFF' : colors.disabled,
              }
            ]}
          >
            {value && (
              <Ionicons 
                name="power" 
                size={13}
                color={colors.primary} 
                style={styles.iconStyle} 
              />
            )}
          </Animated.View>

          {/* Futuristic track elements */}
          <View style={styles.trackElements}>
            {[...Array(3)].map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.trackDot,
                  { 
                    backgroundColor: value ? '#FFFFFF' : 'transparent',
                    opacity: value ? 0.6 - (i * 0.15) : 0.2,
                  }
                ]} 
              />
            ))}
          </View>
          
          {/* Glow effect */}
          {value && (
            <Animated.View 
              style={[
                styles.glow,
                { 
                  backgroundColor: colors.primary,
                  opacity: glowOpacity,
                }
              ]} 
            />
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    marginBottom: 2,
    alignItems: 'center',
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  touchableArea: {
    padding: 8,
  },
  track: {
    width: 70,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  iconStyle: {
    opacity: 0.8,
  },
  trackElements: {
    position: 'absolute',
    flexDirection: 'row',
    top: '50%',
    left: '50%',
    width: 30,
    transform: [{ translateY: -3 }, { translateX: -15 }],
    justifyContent: 'space-between',
    zIndex: 1,
  },
  trackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  glow: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 40,
    height: 40,
    borderRadius: 20,
    zIndex: 0,
    opacity: 0.3,
  },
  powerIndicator: {
    position: 'absolute',
    top: 5,
    left: 5,
    zIndex: 4,
  },
  powerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default FuturisticSwitch; 