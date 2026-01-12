import { CardType, Channel, CreditCardECI, CVS, OrderState, PaymentEvents, PaymentPeriodType } from '../src/typings';

describe('Payment Typings', () => {
  describe('CardType', () => {
    it('should have VMJ card type', () => {
      expect(CardType.VMJ).toBe('VMJ');
    });

    it('should have AE card type', () => {
      expect(CardType.AE).toBe('AE');
    });
  });

  describe('Channel', () => {
    it('should have CREDIT_CARD channel', () => {
      expect(Channel.CREDIT_CARD).toBe('CREDIT_CARD');
    });

    it('should have WEB_ATM channel', () => {
      expect(Channel.WEB_ATM).toBe('WEB_ATM');
    });

    it('should have VIRTUAL_ACCOUNT channel', () => {
      expect(Channel.VIRTUAL_ACCOUNT).toBe('VIRTUAL_ACCOUNT');
    });

    it('should have CVS_KIOSK channel', () => {
      expect(Channel.CVS_KIOSK).toBe('CVS_KIOSK');
    });

    it('should have CVS_BARCODE channel', () => {
      expect(Channel.CVS_BARCODE).toBe('CVS_BARCODE');
    });

    it('should have APPLE_PAY channel', () => {
      expect(Channel.APPLE_PAY).toBe('APPLE_PAY');
    });

    it('should have LINE_PAY channel', () => {
      expect(Channel.LINE_PAY).toBe('LINE_PAY');
    });
  });

  describe('CreditCardECI', () => {
    it('should have MASTER_3D', () => {
      expect(CreditCardECI.MASTER_3D).toBe('2');
    });

    it('should have MASTER_3D_PART', () => {
      expect(CreditCardECI.MASTER_3D_PART).toBe('1');
    });

    it('should have MASTER_3D_FAILED', () => {
      expect(CreditCardECI.MASTER_3D_FAILED).toBe('0');
    });

    it('should have VISA_AE_JCB_3D', () => {
      expect(CreditCardECI.VISA_AE_JCB_3D).toBe('5');
    });

    it('should have VISA_AE_JCB_3D_PART', () => {
      expect(CreditCardECI.VISA_AE_JCB_3D_PART).toBe('6');
    });

    it('should have VISA_AE_JCB_3D_FAILED', () => {
      expect(CreditCardECI.VISA_AE_JCB_3D_FAILED).toBe('7');
    });
  });

  describe('CVS', () => {
    it('should have FAMILY_MART', () => {
      expect(CVS.FAMILY_MART).toBe('FAMILY_MART');
    });

    it('should have HILIFE', () => {
      expect(CVS.HILIFE).toBe('HILIFE');
    });

    it('should have OK_MART', () => {
      expect(CVS.OK_MART).toBe('OK_MART');
    });

    it('should have SEVEN_ELEVEN', () => {
      expect(CVS.SEVEN_ELEVEN).toBe('SEVEN_ELEVEN');
    });
  });

  describe('OrderState', () => {
    it('should have INITED state', () => {
      expect(OrderState.INITED).toBe('INITED');
    });

    it('should have PRE_COMMIT state', () => {
      expect(OrderState.PRE_COMMIT).toBe('PRE_COMMIT');
    });

    it('should have ASYNC_INFO_RETRIEVED state', () => {
      expect(OrderState.ASYNC_INFO_RETRIEVED).toBe('ASYNC_INFO_RETRIEVED');
    });

    it('should have COMMITTED state', () => {
      expect(OrderState.COMMITTED).toBe('COMMITTED');
    });

    it('should have FAILED state', () => {
      expect(OrderState.FAILED).toBe('FAILED');
    });

    it('should have REFUNDED state', () => {
      expect(OrderState.REFUNDED).toBe('REFUNDED');
    });
  });

  describe('PaymentEvents', () => {
    it('should have SERVER_LISTENED event', () => {
      expect(PaymentEvents.SERVER_LISTENED).toBe('LISTENED');
    });

    it('should have ORDER_INFO_RETRIEVED event', () => {
      expect(PaymentEvents.ORDER_INFO_RETRIEVED).toBe('INFO_RETRIEVED');
    });

    it('should have ORDER_PRE_COMMIT event', () => {
      expect(PaymentEvents.ORDER_PRE_COMMIT).toBe('PRE_COMMIT');
    });

    it('should have ORDER_COMMITTED event', () => {
      expect(PaymentEvents.ORDER_COMMITTED).toBe('COMMITTED');
    });

    it('should have ORDER_FAILED event', () => {
      expect(PaymentEvents.ORDER_FAILED).toBe('FAILED');
    });

    it('should have CARD_BOUND event', () => {
      expect(PaymentEvents.CARD_BOUND).toBe('CARD_BOUND');
    });

    it('should have CARD_BINDING_FAILED event', () => {
      expect(PaymentEvents.CARD_BINDING_FAILED).toBe('CARD_BINDING_FAILED');
    });
  });

  describe('PaymentPeriodType', () => {
    it('should have DAY type', () => {
      expect(PaymentPeriodType.DAY).toBe('DAY');
    });

    it('should have MONTH type', () => {
      expect(PaymentPeriodType.MONTH).toBe('MONTH');
    });

    it('should have YEAR type', () => {
      expect(PaymentPeriodType.YEAR).toBe('YEAR');
    });
  });
});
