import React from 'react';
import {Button, View, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {NavigationProp} from '@react-navigation/native';

// Types
export type CustomHeaderProps = {
  navigation: NavigationProp<any>;
  style?: StyleProp<ViewStyle>;
};

const CustomHeader: React.FC<CustomHeaderProps> = ({navigation, style}) => {
  return (
    <View style={[styles.container, style]}>
      <Button
        title="Sign Out"
        onPress={() => navigation.navigate('LandingPage')} // Navigates to the LandingPage
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
});

export default CustomHeader;
