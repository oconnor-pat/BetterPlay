import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {useTheme} from '../ThemeContext/ThemeContext';
import LegalDocument from './LegalDocument';

const PrivacyPolicy: React.FC = () => {
  const {colors} = useTheme();

  const styles = StyleSheet.create({
    heading: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 20,
      marginBottom: 10,
    },
    subheading: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 15,
      marginBottom: 8,
    },
    paragraph: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      marginBottom: 10,
    },
    bulletPoint: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      marginLeft: 15,
      marginBottom: 5,
    },
    bold: {
      fontWeight: '600',
    },
    footer: {
      fontSize: 14,
      color: colors.placeholder,
      marginTop: 30,
      textAlign: 'center',
    },
  });

  return (
    <LegalDocument title="Privacy Policy" lastUpdated="January 2, 2026">
      <Text style={styles.heading}>Introduction</Text>
      <Text style={styles.paragraph}>
        BetterPlay ("we," "our," or "us") is committed to protecting your
        privacy. This Privacy Policy explains how we collect, use, and safeguard
        your information when you use our mobile application.
      </Text>

      <Text style={styles.heading}>Information We Collect</Text>

      <Text style={styles.subheading}>Information You Provide</Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Account Information:</Text> When you create
        an account, we collect your name, email address, and profile
        information.
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Event Data:</Text> Information about events
        you create or join, including location, date, time, and participant
        lists.
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Profile Photos:</Text> Images you upload for
        your profile or events.
      </Text>

      <Text style={styles.subheading}>Information Collected Automatically</Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Location Data:</Text> With your permission,
        we collect your device's location to show nearby venues and events. You
        can disable this in your device settings.
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Device Information:</Text> We may collect
        device type, operating system version, and app version for
        troubleshooting and improving our services.
      </Text>

      <Text style={styles.heading}>How We Use Your Information</Text>
      <Text style={styles.paragraph}>
        We use the information we collect to:
      </Text>
      <Text style={styles.bulletPoint}>
        • Provide and maintain the BetterPlay service
      </Text>
      <Text style={styles.bulletPoint}>
        • Show you relevant events and venues near you
      </Text>
      <Text style={styles.bulletPoint}>
        • Connect you with other users for sporting activities
      </Text>
      <Text style={styles.bulletPoint}>
        • Send you notifications about events you've joined
      </Text>
      <Text style={styles.bulletPoint}>
        • Improve and personalize your experience
      </Text>
      <Text style={styles.bulletPoint}>
        • Respond to your requests and support needs
      </Text>

      <Text style={styles.heading}>Data Sharing</Text>
      <Text style={styles.paragraph}>
        We do not sell your personal information. We may share your information
        only in the following circumstances:
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>With Other Users:</Text> Your profile name
        and event participation are visible to other BetterPlay users.
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Service Providers:</Text> We may share data
        with third-party services that help us operate the app.
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Legal Requirements:</Text> We may disclose
        information if required by law or to protect our rights and safety.
      </Text>

      <Text style={styles.heading}>Data Security</Text>
      <Text style={styles.paragraph}>
        We implement appropriate technical and organizational measures to
        protect your personal information against unauthorized access,
        alteration, disclosure, or destruction.
      </Text>

      <Text style={styles.heading}>Your Rights</Text>
      <Text style={styles.paragraph}>You have the right to:</Text>
      <Text style={styles.bulletPoint}>
        • Access the personal information we hold about you
      </Text>
      <Text style={styles.bulletPoint}>
        • Request correction of inaccurate information
      </Text>
      <Text style={styles.bulletPoint}>
        • <Text style={styles.bold}>Delete your account</Text> at any time
        through the app's Settings page
      </Text>
      <Text style={styles.bulletPoint}>
        • Opt out of location tracking at any time
      </Text>
      <Text style={styles.bulletPoint}>• Opt out of push notifications</Text>

      <Text style={styles.heading}>Children's Privacy</Text>
      <Text style={styles.paragraph}>
        BetterPlay is not intended for children under 13 years of age. We do not
        knowingly collect personal information from children under 13.
      </Text>

      <Text style={styles.heading}>Changes to This Policy</Text>
      <Text style={styles.paragraph}>
        We may update this Privacy Policy from time to time. We will notify you
        of any changes by posting the new Privacy Policy in the app and updating
        the "Last Updated" date.
      </Text>

      <Text style={styles.heading}>Contact Us</Text>
      <Text style={styles.paragraph}>
        If you have questions about this Privacy Policy, please contact us at:
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>Email:</Text> support@betterplay.app
      </Text>

      <Text style={styles.footer}>
        © 2026 Patrick O'Connor. All rights reserved.
      </Text>
    </LegalDocument>
  );
};

export default PrivacyPolicy;
