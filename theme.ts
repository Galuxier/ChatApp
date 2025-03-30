// theme.ts
import { StyleSheet } from 'react-native';

// สีหลัก
export const colors = {
  primary: '#3498db',
  primaryDark: '#2980b9',
  primaryLight: '#5dade2',
  primaryGradient: ['#3498db', '#2980b9'],
  secondary: '#2ecc71',
  secondaryDark: '#27ae60',
  accent: '#f39c12',
  background: '#f5f9fc', // เปลี่ยนเป็นสีที่อ่อนกว่าเล็กน้อยพร้อมนัยสีฟ้าอ่อน
  card: '#ffffff',
  text: '#2c3e50',
  textSecondary: '#7f8c8d',
  textLight: '#bdc3c7',
  border: '#ecf0f1',
  error: '#e74c3c',
  unread: '#f1c40f',
  success: '#2ecc71',
  placeholder: '#95a5a6',
  inputBackground: '#f5f7fa',
};

// มิติและขนาด
export const metrics = {
  baseRadius: 12,
  smallRadius: 8,
  baseMargin: 16,
  smallMargin: 8,
  doubleBaseMargin: 32,
  basePadding: 16,
  smallPadding: 8,
  avatarSizeLarge: 60,
  avatarSize: 50,
  avatarSizeSmall: 40,
  buttonHeight: 50,
  iconSize: 24,
  iconSizeSmall: 18,
};

// ฟอนต์และการใช้ตัวหนังสือ
export const typography = {
  fontSizeExtraSmall: 10,
  fontSizeSmall: 12,
  fontSizeRegular: 14,
  fontSizeMedium: 16,
  fontSizeLarge: 18,
  fontSizeExtraLarge: 22,
  fontWeightLight: '300',
  fontWeightRegular: '400',
  fontWeightMedium: '600',
  fontWeightBold: '700',
};

// Shadows
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Common styles
export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: metrics.basePadding,
    paddingVertical: metrics.basePadding,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.small,
  },
  headerTitle: {
    fontSize: typography.fontSizeExtraLarge,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.fontSizeRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: metrics.smallPadding,
    paddingHorizontal: metrics.basePadding,
    borderRadius: metrics.baseRadius,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: metrics.buttonHeight,
    ...shadows.small,
  },
  buttonText: {
    color: 'white',
    fontWeight: typography.fontWeightBold,
    fontSize: typography.fontSizeMedium,
  },
  inputContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: metrics.baseRadius,
    paddingHorizontal: metrics.basePadding,
    paddingVertical: metrics.smallPadding,
    ...shadows.small,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: metrics.baseRadius,
    padding: metrics.basePadding,
    marginBottom: metrics.baseMargin,
    ...shadows.small,
  },
  avatar: {
    width: metrics.avatarSize,
    height: metrics.avatarSize,
    borderRadius: metrics.avatarSize / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: typography.fontWeightBold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: metrics.smallMargin,
  },
  iconButton: {
    padding: metrics.smallPadding,
    borderRadius: metrics.baseRadius,
  },
  fab: {
    position: 'absolute',
    bottom: metrics.doubleBaseMargin,
    right: metrics.doubleBaseMargin,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  fabIcon: {
    color: 'white',
    fontSize: 24,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: metrics.doubleBaseMargin,
  },
  emptyStateTitle: {
    fontSize: typography.fontSizeLarge,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
    marginBottom: metrics.smallMargin,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizeRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: metrics.doubleBaseMargin,
  },
});