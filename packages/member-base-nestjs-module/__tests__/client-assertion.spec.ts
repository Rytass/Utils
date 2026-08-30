import { createHash, X509Certificate } from 'node:crypto';
import { verify, decode } from 'jsonwebtoken';
import {
  assertUsableCertificate,
  certificateToX5tS256,
  clientAssertionParams,
  signClientAssertion,
  CLIENT_ASSERTION_TYPE,
} from '../src/utils/client-assertion';
import { AuthProviderMisconfiguredError } from '../src/constants/errors/base.error';

/**
 * Throwaway self-signed certificates generated for this suite and used nowhere
 * else. Two independent pairs, so a mismatch can actually be exercised.
 */
const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDAzCCAeugAwIBAgIUeoL4NZ74LZIebfv8U1SuDrecVU4wDQYJKoZIhvcNAQEL
BQAwETEPMA0GA1UEAwwGcGFpci1hMB4XDTI2MDgzMDE2MzU0M1oXDTM2MDgyNzE2
MzU0M1owETEPMA0GA1UEAwwGcGFpci1hMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAqT7Hih2GBs68El7FUakwWg36StQP3HU+pGL8h7CgMTWehZbHGHwu
Wrp/RoHYdBnwJpJ1WtPtmUFAlkV3XFxahSz+185PZkeR1N+/rvjk3yLkVBFd4orW
S07Z382rBctSc1hzFThcDJJ31QD1c5jPRU+qYigBmwnlySNqUZ16VpMd1h5mLFh3
eLE/pSvxp83O1Hiee/s4uRnb1QOmns+2VqMO1tVjdKlXWFQKl394+eZzbQh+frdQ
+0Qkh3UOfsPg2np+c3GV9rCo2jmsqRaXg2Qm/gp/NZcetXEcpPuYcEK1Qeex2gUq
CHbchpeMvAqmc0LHp20zrOfRPgqk5+YHpwIDAQABo1MwUTAdBgNVHQ4EFgQUYi4K
6bGY/fBaBM9tM+Y8zAov4zAwHwYDVR0jBBgwFoAUYi4K6bGY/fBaBM9tM+Y8zAov
4zAwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAn9ndYcYFC9Tk
dRyHkmEEvbZ0k3/g9bC2wbxc7hMyv4eTD5xYNLfgeDYzQFzpNHv+V3yJUsdpc07d
SmQwS/ZuJJTnV3dPlL/xMsVZ/QDfnBjt7Q4P4MtGm3cpXTqkdRPzqnlGga7tmkWN
mAdQ0JIQtAwYf0iPQBG9exSIj+4tDlrbqTsMnuUQnntgdLfQZq03JTVBjJnFCGUm
LZs9h9H3eg1InITUhV0q09WfvdIyuamNXSoWNDEF//oDAcu+tBWukfwozi1ntcdX
ejN0r7PzvGp8rX5z4+VbsuiEBYWOcg8R7qEyCaTP09+iKx2XM3UIuitf2wdWYvqm
Ns7QCHS8nQ==
-----END CERTIFICATE-----`;

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpPseKHYYGzrwS
XsVRqTBaDfpK1A/cdT6kYvyHsKAxNZ6FlscYfC5aun9Ggdh0GfAmknVa0+2ZQUCW
RXdcXFqFLP7Xzk9mR5HU37+u+OTfIuRUEV3iitZLTtnfzasFy1JzWHMVOFwMknfV
APVzmM9FT6piKAGbCeXJI2pRnXpWkx3WHmYsWHd4sT+lK/Gnzc7UeJ57+zi5GdvV
A6aez7ZWow7W1WN0qVdYVAqXf3j55nNtCH5+t1D7RCSHdQ5+w+Daen5zcZX2sKja
OaypFpeDZCb+Cn81lx61cRyk+5hwQrVB57HaBSoIdtyGl4y8CqZzQsenbTOs59E+
CqTn5genAgMBAAECggEAAd3Di9nVRsLAdn1zCxYMjY3GZBzKsL2ESjX7YqC983kS
rOLRe2GceSMN7iE+T0fs3CTItO9z3jkPd7mbIbHzH2wfkhjUAmTbKEBzmLBQk2aE
NLE4xAAF0nypGxcxorPv/sobJH9GQHe5p0Hxed+h2iG6oAn6ko3FFuCGeh7/6voH
If+urMTRtc9AMSPmegHVJ78pnax3u98nSh25FbAHGfMCZ9QNOfA1cJTIP+K5v16v
o4yFHSwSARIiqm8Ejhho2atcoyoBdCQqG9KkzlFG1tIYgOfzdulhYT+JByTgcrPi
E3OY80PcFneJrbjixffWixyWfgXQtVzivJzUWm6cqQKBgQDc/6yh0tqJht6a3UUo
/eLYmcYHqq6t0husEIWfdDkmMmJDf8Po4FDny44aRAqDwHZdiCOGw9ZuKmXjZSHu
c49Pc8vUus8LgMe9VDxwsunshA7hKMRPfl/oIBCsFP9QBKDyPvVADslkxCkL3QB+
gc8Bv9UfNwtfa4fJDqStzcb2zQKBgQDEDMaGz4cHBqt05YxeT1VsyjbyM8bNXCH+
aeX8/zTn9ngaLDc4LXPRTG8Ex2XJ3jnCZuRK3+cpWu8GlCqty4p+uRF5I2C2EOyY
FKTOUu/MWPgWum4pJg+xlB+1JkYqpBja3cgNTkEfNsi2liCN+kXDiZnM7fYI2+ji
3IQxZsEwQwKBgHGXBI9EhkkLxl0JACQ6op88IpoMM65qAQkmkNfNcBZe7TzObc7D
hTIu4QJFGLZxdSVL9R6uiAelySrg71jVksJ+vTTBM+wwq/l3U32FqFCF6/P09Tn6
tabk3Ezmmffx+RuqGnprXz5oyMQtOrTLWbAHfq6Fp1XLOkawPRqMWwi9AoGAXX3O
KrnKpaIbn6pcDxl8Hl4sZ8IjOwmFuIKdx9GYVEooKisNxj9+rL/rbXb9ZpAQMVHJ
6p7t6L3RoOyFkc2v5RCycXdahlh5y2iE01OfwW5oGMadBAh/kWqW2FdBPNJ2e+Ep
ppa73XvNqazcJ3jDTiVPb/fGzaC5ZX5NmBVtaWsCgYEAvpqm1q9AgsvQ3uVmgpE8
Ubw5E4N7E9Vh8YFdlS7kvjgkUYnSPNkZcnKjDUSirY9krEv1bPYqlfuKGPByiezI
RbEOEHuzTMhTcntKM/o42f+ir2zto2+etXHMoOencMgbxLwfBM+9LuOQ6f1xUoiZ
lQErIBb8Hq1mKAhDm+JrBj0=
-----END PRIVATE KEY-----`;

/** A key belonging to a different certificate entirely. */
const OTHER_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8GvpKGN44dJq7
lPrMetgKhUlIZ6eFHae+WVQoFpnir5klu3H4xpDxnaC1ZOrxEFphMAd727RUNvX2
zmfUpJ/c8fksyd2WM53pK+Mni2hAkRWp0pbJiTVSJallNVUP/g3ygsG7Oh8XlFNa
cBdw9WHk5xE/Nt0xarWDQcb1ncXYacCQo9M6mDZAstQUKoPex59JPj1vI20GYXIW
fbGBiayjqj92/tPz6NRxj3ftRdIlHPJaJ0yPs9aTLyGQOclQWP0wZTELPW6IXE9F
LAhJ6u/2ohPgHfQI61wrZIzePjaim0Eyh3lElBAQiaWQ4/0NXB6n2rT6korBYoiy
20CG5UglAgMBAAECggEAWtzJNAupJConKB9Buo5IV2SkzoXLZMC7a3Yo8ahhMx/R
YWmXFy2LjDqxC44w8rsMfU++/bRV+iwGSe7QNuZClm6IB3uHPuu2BpD9i/eKJ04t
4bdowPc3O3QXzFyjtzLoN9GzlSXxKOmsDc6BdD4DyJdZPGjbFejOvxWB7tkEXZF7
GpXaULALpfP+MayVdJy7z+ptH3Qs1lx6q27pOE8BPAXc+gPAKFkPOsjnijmfdnOD
1U2itW1FnEp00j6iDHdTEQcYlq4nRAXOU6qryAXSuX16MonB9UBuWMfWkvB1eyPs
7VGmSqyLNkqeslZJW9OP/+84r7+BKmAvpIPT1jxuzQKBgQDtdLZyhg8z1XID7JFz
1s1IyQmw7w+VXwYcu0ewhY1QLydHEAQtRvfz+7EnCQ7Ohyuh8JbuBGV7CIk3R2/5
xMp2ndlV3NpKGrhrPypABPARE0V2h0QCNGQDL5hKtn1ccDiaylD8S7mrSzR0jJzJ
WCkUzY+OUpDUej2z2Hoznm6l1wKBgQDKy6KNccbYdxx0Rso+qEljzFLAlFkw/8Yi
SiSzfvjUumNHVEjv06yjAL96ldh3moWrhsTsrudfmLfoOYJIG8/erIkcHGeTAQ07
qb79pN3uM6cclS+5YIOZPyiOkXAYaS98LSzommj8qgy3//nlUp2EZv3tIL1AOsKk
keT3L81KYwKBgATzB9J/RNXZvxSh265Ebeb0ecU8VmDQqDn1FVtyjS18rh7nEI85
CXYGavzbTXm0i45Gi37OjKbx2JpUXNsh5O5v/9WwUsR0ph9mI6VN9QsGEc6UpzA8
k1EVruDvyNEibaucR+/aTDZrzN4ZCDOSKNkMJ8/ZnLcxDRQwkOt+g+PlAoGARr5O
0GTWZwD2LiHbv4vZPjUy0PdvPcacCa4vq2Ypy5vRsjpWz0LaQGqsYUkQoHiJFNMI
s0A4eoK99QbKyfjZxOYPVn0aLI/7W8rVU4pF2SivrSrl4RcoETeVIFbf8cQPypO/
zMzAvxNbKHzlYfg19tAu2J/JJTTaXap/YzOLu90CgYAuv0rMkfYQnbkwglHeFs1Y
OkoOFfzJ3je+gie6iPLWinPe3oDMrLFAWGFV7NpqwVuC/UWlqXUdMGw7rOqHn1vF
e0ia5dbSg6enpKe6Rm5rZRlBxNTY7uC9Lf26t0Z9YbgoUQ4ciZxgSSiamv+JEcQ/
M4Kz4lNuEAcQe40x13A+DQ==
-----END PRIVATE KEY-----`;

const AUDIENCE = 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token';

describe('client assertion (private_key_jwt)', () => {
  describe('header', () => {
    it('should sign PS256 with an x5t#S256 derived from the certificate', () => {
      const assertion = signClientAssertion({
        clientId: 'client-id',
        audience: AUDIENCE,
        credential: { certificate: CERTIFICATE, privateKey: PRIVATE_KEY },
      });

      const header = JSON.parse(Buffer.from(assertion.split('.')[0], 'base64url').toString('utf8'));

      expect(header.alg).toBe('PS256');
      expect(header.typ).toBe('JWT');
      // Independently computed, so the test cannot pass by agreeing with the
      // implementation's own idea of the thumbprint.
      expect(header['x5t#S256']).toBe(
        createHash('sha256').update(new X509Certificate(CERTIFICATE).raw).digest('base64url'),
      );

      // The SHA-1 form the older specification used must not appear.
      expect(header.x5t).toBeUndefined();
    });

    it('should expose the same thumbprint through certificateToX5tS256', () => {
      expect(certificateToX5tS256(CERTIFICATE)).toBe(
        createHash('sha256').update(new X509Certificate(CERTIFICATE).raw).digest('base64url'),
      );
    });
  });

  describe('claims', () => {
    it('should carry the RFC 7523 claims, with the client as both issuer and subject', () => {
      const before = Math.floor(Date.now() / 1000);
      const assertion = signClientAssertion({
        clientId: 'client-id',
        audience: AUDIENCE,
        credential: { certificate: CERTIFICATE, privateKey: PRIVATE_KEY },
      });

      const claims = decode(assertion) as Record<string, unknown>;

      expect(claims.iss).toBe('client-id');
      expect(claims.sub).toBe('client-id');
      expect(claims.aud).toBe(AUDIENCE);
      expect(typeof claims.jti).toBe('string');
      expect(claims.nbf).toBeGreaterThanOrEqual(before);
      // Short lived: it is minted per request and never reused.
      expect((claims.exp as number) - (claims.iat as number)).toBeLessThanOrEqual(120);
    });

    it('should mint a fresh jti every time', () => {
      const sign = (): string =>
        signClientAssertion({
          clientId: 'client-id',
          audience: AUDIENCE,
          credential: { certificate: CERTIFICATE, privateKey: PRIVATE_KEY },
        });

      const ids = new Set([sign(), sign(), sign()].map(a => (decode(a) as { jti: string }).jti));

      // A replayed jti is a replayable credential.
      expect(ids.size).toBe(3);
    });

    it('should produce a signature that verifies under the certificate public key', () => {
      const assertion = signClientAssertion({
        clientId: 'client-id',
        audience: AUDIENCE,
        credential: { certificate: CERTIFICATE, privateKey: PRIVATE_KEY },
      });

      const publicKey = new X509Certificate(CERTIFICATE).publicKey;

      expect(() =>
        verify(assertion, publicKey, { algorithms: ['PS256'], audience: AUDIENCE, issuer: 'client-id' }),
      ).not.toThrow();
    });
  });

  describe('form parameters', () => {
    it('should use the RFC 7523 assertion type', () => {
      const params = clientAssertionParams({
        clientId: 'client-id',
        audience: AUDIENCE,
        credential: { certificate: CERTIFICATE, privateKey: PRIVATE_KEY },
      });

      expect(params.client_assertion_type).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      expect(CLIENT_ASSERTION_TYPE).toBe(params.client_assertion_type);
      expect(typeof params.client_assertion).toBe('string');
    });
  });

  describe('credential validation', () => {
    it('should accept a matching pair', () => {
      expect(() => assertUsableCertificate({ certificate: CERTIFICATE, privateKey: PRIVATE_KEY })).not.toThrow();
    });

    it('should refuse a certificate and key that are not a pair', () => {
      // Both are individually valid PEM. Nothing downstream would complain: the
      // assertion signs, and the issuer answers a bare invalid_client.
      expect(() => assertUsableCertificate({ certificate: CERTIFICATE, privateKey: OTHER_PRIVATE_KEY })).toThrow(
        AuthProviderMisconfiguredError,
      );

      expect(() => assertUsableCertificate({ certificate: CERTIFICATE, privateKey: OTHER_PRIVATE_KEY })).toThrow(
        /are not a pair/,
      );
    });

    it('should say what a mismatch leaves as the remaining cause', () => {
      try {
        assertUsableCertificate({ certificate: CERTIFICATE, privateKey: OTHER_PRIVATE_KEY });
      } catch (error) {
        // The other cause of invalid_client is unknowable from here, so the
        // message names it rather than leaving the reader to guess.
        expect((error as Error).message).toContain('never uploaded to this application registration');
      }
    });

    it('should name the private key when it is the unreadable half', () => {
      expect(() => assertUsableCertificate({ certificate: CERTIFICATE, privateKey: 'not a key' })).toThrow(
        /clientCertificate\.privateKey is not a readable PEM/,
      );
    });

    it('should point at the likely mistake when the certificate is a key', () => {
      expect(() => assertUsableCertificate({ certificate: PRIVATE_KEY, privateKey: PRIVATE_KEY })).toThrow(
        /not the private key/,
      );
    });
  });
});
