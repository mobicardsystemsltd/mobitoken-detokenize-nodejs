const crypto = require('crypto');
const axios = require('axios');

class MobicardDetokenization {
    constructor(merchantId, apiKey, secretKey) {
        this.mobicardVersion = "2.0";
        this.mobicardMode = "LIVE";
        this.mobicardMerchantId = merchantId;
        this.mobicardApiKey = apiKey;
        this.mobicardSecretKey = secretKey;
        this.mobicardServiceId = "20000";
        this.mobicardServiceType = "DETOKENIZATION";
        
        this.mobicardTokenId = Math.floor(Math.random() * (1000000000 - 1000000 + 1)) + 1000000;
        this.mobicardTxnReference = Math.floor(Math.random() * (1000000000 - 1000000 + 1)) + 1000000;
    }

    generateJWT(cardToken) {
        const jwtHeader = { typ: "JWT", alg: "HS256" };
        const encodedHeader = Buffer.from(JSON.stringify(jwtHeader)).toString('base64url');

        const jwtPayload = {
            mobicard_version: this.mobicardVersion,
            mobicard_mode: this.mobicardMode,
            mobicard_merchant_id: this.mobicardMerchantId,
            mobicard_api_key: this.mobicardApiKey,
            mobicard_service_id: this.mobicardServiceId,
            mobicard_service_type: this.mobicardServiceType,
            mobicard_token_id: this.mobicardTokenId.toString(),
            mobicard_txn_reference: this.mobicardTxnReference.toString(),
            mobicard_card_token: cardToken
        };

        const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');

        const headerPayload = `${encodedHeader}.${encodedPayload}`;
        const signature = crypto.createHmac('sha256', this.mobicardSecretKey)
            .update(headerPayload)
            .digest('base64url');

        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }

    async detokenize(cardToken) {
        try {
            const jwtToken = this.generateJWT(cardToken);
            
            const url = "https://mobicardsystems.com/api/v1/card_tokenization";
            const payload = { mobicard_auth_jwt: jwtToken };

            const response = await axios.post(url, payload, {
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
            });

            const responseData = response.data;

            if (responseData.status === 'SUCCESS') {
                const result = {
                    status: 'SUCCESS',
                    cardNumber: responseData.card_information.card_number,
                    cardNumberMasked: responseData.card_information.card_number_masked,
                    cardExpiryDate: responseData.card_information.card_expiry_date,
                    cardToken: responseData.card_information.card_token,
                    singleUseTokenFlag: responseData.mobicard_single_use_token_flag || '0',
                    rawResponse: responseData
                };

                // Check if new token was generated
                if (result.singleUseTokenFlag === '1') {
                    result.newTokenGenerated = true;
                    result.message = "New token generated. Update your database.";
                }

                return result;
            } else {
                return {
                    status: 'ERROR',
                    statusCode: responseData.status_code,
                    statusMessage: responseData.status_message
                };
            }
        } catch (error) {
            return {
                status: 'ERROR',
                errorMessage: error.message
            };
        }
    }
}

// Usage
async function main() {
    const detokenizer = new MobicardDetokenization(
        "",
        "",
        ""
    );

    // Token from your database
    const cardToken = "bbaefff665082af8f3a41fa51853062b1628345cec085498bba97e3ae3b1e77e4f7ac5ee0ac9bbf10ff8c151d006d80212a3dac731c48188a9e00f9084b163bf";

    const result = await detokenizer.detokenize(cardToken);

    if (result.status === 'SUCCESS') {
        console.log("Detokenization Successful!");
        console.log(`Card Number: ${result.cardNumberMasked}`);
        console.log(`Expiry Date: ${result.cardExpiryDate}`);
        
        if (result.newTokenGenerated) {
            console.log(`New Token: ${result.cardToken}`);
            console.log(result.message);
        }
        
        // Use result.cardNumber for payment processing
    } else {
        console.log(`Error: ${result.statusMessage}`);
    }
}

main();
