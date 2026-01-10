import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {useTheme} from '../ThemeContext/ThemeContext';
import LegalDocument from './LegalDocument';

const TermsOfService: React.FC = () => {
  const {colors} = useTheme();

  const styles = StyleSheet.create({
    heading: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 20,
      marginBottom: 10,
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
    <LegalDocument title="Terms of Service" lastUpdated="January 10, 2026">
      <Text style={styles.paragraph}>
        This End User License Agreement ("Agreement") is a legal agreement
        between you ("User" or "you") and Patrick O'Connor ("Developer," "we,"
        "us," or "our") for the use of the BetterPlay mobile application
        ("App").
      </Text>
      <Text style={styles.paragraph}>
        By downloading, installing, or using the App, you agree to be bound by
        the terms of this Agreement. If you do not agree to these terms, do not
        use the App.
      </Text>

      <Text style={styles.heading}>1. License Grant</Text>
      <Text style={styles.paragraph}>
        Subject to your compliance with this Agreement, we grant you a limited,
        non-exclusive, non-transferable, revocable license to download, install,
        and use the App for your personal, non-commercial purposes.
      </Text>

      <Text style={styles.heading}>2. License Restrictions</Text>
      <Text style={styles.paragraph}>You agree not to:</Text>
      <Text style={styles.bulletPoint}>
        • Copy, modify, or distribute the App
      </Text>
      <Text style={styles.bulletPoint}>
        • Reverse engineer, decompile, or disassemble the App
      </Text>
      <Text style={styles.bulletPoint}>
        • Rent, lease, lend, sell, or sublicense the App
      </Text>
      <Text style={styles.bulletPoint}>
        • Use the App for any unlawful purpose
      </Text>
      <Text style={styles.bulletPoint}>
        • Use the App to harass, abuse, or harm others
      </Text>
      <Text style={styles.bulletPoint}>
        • Create fake accounts or impersonate others
      </Text>
      <Text style={styles.bulletPoint}>
        • Post inappropriate, offensive, or harmful content
      </Text>

      <Text style={styles.heading}>3. User Content</Text>
      <Text style={styles.paragraph}>
        You retain ownership of any content you create or upload through the App
        ("User Content"). By posting User Content, you grant us a worldwide,
        non-exclusive, royalty-free license to use, display, and distribute your
        User Content in connection with operating the App.
      </Text>

      <Text style={styles.heading}>4. Account Registration</Text>
      <Text style={styles.paragraph}>
        To use certain features of the App, you must create an account. You
        agree to provide accurate information, maintain the security of your
        credentials, and accept responsibility for all activities under your
        account.
      </Text>

      <Text style={styles.heading}>5. Privacy</Text>
      <Text style={styles.paragraph}>
        Your use of the App is also governed by our Privacy Policy, which is
        incorporated into this Agreement by reference.
      </Text>

      <Text style={styles.heading}>6. Intellectual Property</Text>
      <Text style={styles.paragraph}>
        The App and all content, features, and functionality are owned by the
        Developer and are protected by copyright, trademark, and other
        intellectual property laws.
      </Text>

      <Text style={styles.heading}>7. Disclaimer of Warranties</Text>
      <Text style={styles.paragraph}>
        THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
        KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE
        DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </Text>

      <Text style={styles.heading}>8. Limitation of Liability</Text>
      <Text style={styles.paragraph}>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE DEVELOPER
        BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES.
      </Text>

      <Text style={styles.heading}>9. Termination</Text>
      <Text style={styles.paragraph}>
        We may terminate or suspend your access to the App immediately, without
        prior notice, for any reason. You may terminate your account at any time
        through the Settings menu.
      </Text>

      <Text style={styles.heading}>10. Changes to This Agreement</Text>
      <Text style={styles.paragraph}>
        We reserve the right to modify this Agreement at any time. Your
        continued use of the App after such changes constitutes acceptance of
        the new terms.
      </Text>

      <Text style={styles.heading}>11. Governing Law</Text>
      <Text style={styles.paragraph}>
        This Agreement shall be governed by and construed in accordance with the
        laws of the State of New York, United States.
      </Text>

      <Text style={styles.heading}>12. Severability</Text>
      <Text style={styles.paragraph}>
        If any provision of this Agreement is held to be invalid or
        unenforceable, the remaining provisions will continue in full force and
        effect.
      </Text>

      <Text style={styles.heading}>13. Contact Information</Text>
      <Text style={styles.paragraph}>
        If you have questions about this Agreement, please contact us at:
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

export default TermsOfService;
