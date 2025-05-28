import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function IconTest() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Icon Test</Text>
      <View style={styles.iconRow}>
        <Ionicons name="bluetooth" size={32} color="#007AFF" />
        <Text style={styles.label}>Bluetooth</Text>
      </View>
      <View style={styles.iconRow}>
        <Ionicons name="heart" size={32} color="#FF3B30" />
        <Text style={styles.label}>Heart</Text>
      </View>
      <View style={styles.iconRow}>
        <Ionicons name="settings" size={32} color="#34C759" />
        <Text style={styles.label}>Settings</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    width: 120,
  },
  label: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
});