import axios from 'axios';

// --- PKCE Helpers ---
function dec2hex(dec) {
  return ('0' + dec.toString(16)).substr(-2);
}

function generateCodeVerifier() {
  const array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

async function generateCodeChallenge(v) {
  const encoder = new TextEncoder();
  const data = encoder.encode(v);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  // Base64Url encode
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// --------------------

class SalesforceClient {
  constructor(instanceUrl, accessToken) {
    this.instanceUrl = instanceUrl;
    this.accessToken = accessToken;
    this.apiVersion = 'v60.0';
    this.baseUrl = `${instanceUrl}/services/data/${this.apiVersion}`;
  }

  async query(soql) {
    try {
      const targetUrl = `${this.baseUrl}/query?q=${encodeURIComponent(soql)}`;
      const response = await axios.get('/proxy', {
        headers: {
          'x-target-url': targetUrl,
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      const sfError = error.response?.data?.[0]?.message || error.response?.data?.message || error.response?.data || error.message;
      console.error('SOQL Query failed:', soql, 'Error:', sfError);
      throw new Error(`SOQL Error: ${sfError} (Query: ${soql})`);
    }
  }

  async toolingQuery(soql) {
    try {
      const targetUrl = `${this.baseUrl}/tooling/query?q=${encodeURIComponent(soql)}`;
      const response = await axios.get('/proxy', {
        headers: {
          'x-target-url': targetUrl,
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      const sfError = error.response?.data?.[0]?.message || error.response?.data?.message || error.response?.data || error.message;
      console.error('Tooling Query failed:', soql, 'Error:', sfError);
      return { totalSize: 0, records: [] };
    }
  }

  async getLimits() {
    try {
      const targetUrl = `${this.baseUrl}/limits`;
      const response = await axios.get('/proxy', {
        headers: {
          'x-target-url': targetUrl,
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch limits:', error.message);
      return null;
    }
  }

  static async generateAuthCodeUrl(clientId, redirectUri, loginUrl = 'https://login.salesforce.com', loginHint = '') {
    const verifier = generateCodeVerifier();
    sessionStorage.setItem('sf_code_verifier', verifier);
    const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    if (loginHint) {
      params.append('login_hint', loginHint);
    }
    
    return `${loginUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  static async exchangeCodeForToken(code, clientId, clientSecret, redirectUri, loginUrl = 'https://login.salesforce.com') {
    const verifier = sessionStorage.getItem('sf_code_verifier');
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code,
      code_verifier: verifier
    });

    try {
      const targetUrl = `${loginUrl}/services/oauth2/token`;
      const response = await axios.post('/proxy', params.toString(), {
        headers: { 
          'x-target-url': targetUrl,
          'Content-Type': 'application/x-www-form-urlencoded' 
        }
      });
      sessionStorage.removeItem('sf_code_verifier'); // clean up
      return response.data; // { access_token, instance_url }
    } catch (err) {
      console.error('Token exchange failed:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error_description || 'Token Exchange Failed through local proxy. Ensure credentials are correct.');
    }
  }

  static async loginWithPassword(username, password, clientId, clientSecret, loginUrl = 'https://login.salesforce.com') {
    const params = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      client_id: clientId,
      client_secret: clientSecret
    });

    try {
      const targetUrl = `${loginUrl}/services/oauth2/token`;
      const response = await axios.post('/proxy', params.toString(), {
        headers: { 
          'x-target-url': targetUrl,
          'Content-Type': 'application/x-www-form-urlencoded' 
        }
      });
      return response.data; // { access_token, instance_url }
    } catch (err) {
      console.error('Password login failed:', err.response?.data || err.message);
      const desc = err.response?.data?.error_description || 'Direct Login Failed.';
      throw new Error(desc === 'authentication failure' ? 'Invalid credentials or security token required.' : desc);
    }
  }
}

export default SalesforceClient;
