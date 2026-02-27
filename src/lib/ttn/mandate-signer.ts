// Stub implementation for TTN mandate signer
export const getSigningStrategy = () => {
  return {
    sign: async (data: any) => {
      // Placeholder implementation
      throw new Error('TTN mandate signing not yet implemented');
    }
  };
};
