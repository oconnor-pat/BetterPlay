import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faArrowLeft} from '@fortawesome/free-solid-svg-icons';

interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

const LegalDocument: React.FC<LegalDocumentProps> = ({
  title,
  lastUpdated,
  children,
}) => {
  const {colors} = useTheme();
  const navigation = useNavigation();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    lastUpdated: {
      fontSize: 14,
      color: colors.placeholder,
      marginBottom: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: {lastUpdated}</Text>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LegalDocument;
