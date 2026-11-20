import Constants from 'expo-constants'

export const appVersion = () => Constants.expoConfig?.version ?? '0.0.0'
