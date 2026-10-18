/**
 * Temporary stub for mpesaService until Ticket 03 (Backend Routes) migrates public.ts to PaystackService.
 * Will be deleted in Ticket 03.
 */
class MpesaService {
  async initiateSTKPush(_request: { phone: string; amount: number; accountReference: string; transactionDesc: string }) {
    return {
      CheckoutRequestID: 'mock_checkout_' + Date.now(),
      CustomerMessage: 'Success. Request accepted for processing'
    };
  }

  async handleCallback(_callbackData: any): Promise<void> {
    // Stub for legacy callback route
  }
}

export default new MpesaService();