import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

const AppLogo = ({ 
  size = 'large', 
  showText = true, 
  textStyle = {}, 
  containerStyle = {},
  logoStyle = {} 
}) => {
  const sizeConfig = {
    small: { width: 30, height: 30, fontSize: 16 },
    medium: { width: 60, height: 60, fontSize: 20 },
    large: { width: 120, height: 120, fontSize: 24 },
    xlarge: { width: 150, height: 150, fontSize: 28 },
  };

  const config = sizeConfig[size] || sizeConfig.large;

  return (
    <View style={[styles.container, containerStyle]}>
      <Image 
        source={require('../assets/logo-no-text.png')} 
        style={[
          styles.logo, 
          { width: config.width, height: config.height },
          logoStyle
        ]}
        resizeMode="contain"
      />
      {showText && (
        <Text style={[
          styles.text, 
          { fontSize: config.fontSize },
          textStyle
        ]}>
          MindLink (Beta)
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logo: {
    marginBottom: 8,
  },
  text: {
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default AppLogo;
