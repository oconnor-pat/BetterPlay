import React from 'react';
import {Button, View, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {NavigationProp} from '@react-navigation/native';

// Types
export type LandingPageParamList = {
  LandingPage: undefined;
};

export type CustomHeaderNavigationProp = NavigationProp<LandingPageParamList>;

export interface CustomHeaderProps {
  navigation: CustomHeaderNavigationProp;
  style?: StyleProp<ViewStyle>;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({navigation}) => {
  return (
    <View style={styles.container}>
      <Button
        title="Sign Out"
        onPress={() => navigation.navigate('LandingPage')}
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
