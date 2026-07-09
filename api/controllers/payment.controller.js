import pool from '../config/db.js';

// =========================================
// GENERATE QR PAYMENT
// =========================================
export const generatePaymentQR = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get order details
    const orderResult = await pool.query(
      `SELECT id, status, total_amount, payment_status FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    if (order.payment_status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }

    // Generate unique payment code (no dashes — banks may strip them)
    const paymentCode = `DH${orderId}${Date.now()}`;
    const paymentContent = `THANHTOAN${paymentCode}`;

    // Create payment QR data (VietQR format)
    const bankId = process.env.SEPAY_BANK_ID || '970422';
    const bankName = process.env.SEPAY_BANK_NAME || 'MBBank';
    const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER || '';
    const qrUrl = `https://vietqr.app/img?acc=${accountNumber}&bank=${bankName}&amount=${Number(order.total_amount)}&des=${encodeURIComponent(paymentContent)}`;

    const sepayData = {
      bankId,
      bankName,
      accountNumber,
      paymentCode,
      amount: Number(order.total_amount),
      content: paymentContent,
      qrUrl
    };

    // Update order with payment code and bank info
    await pool.query(
      `UPDATE orders
       SET payment_code = $1, payment_content = $2, bank_id = $3, bank_name = $4, account_number = $5
       WHERE id = $6`,
      [paymentCode, paymentContent, bankId, bankName, accountNumber, orderId]
    );

    return res.status(200).json({
      success: true,
      data: {
        paymentCode,
        amount: Number(order.total_amount),
        content: paymentContent,
        bankId,
        bankName,
        accountNumber,
        qrUrl
      }
    });

  } catch (error) {
    console.error('Generate payment QR error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// =========================================
// SEPAY WEBHOOK - VERIFY PAYMENT
// =========================================
export const sepayWebhook = async (req, res) => {
  try {
    // Verify API key from SePay header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Missing authorization header'
      });
    }

    // Check format: "Apikey YOUR_API_KEY"
    const apiKey = authHeader.replace('Apikey ', '').trim();

    if (apiKey !== process.env.SEPAY_API_KEY) {
      console.error('Invalid SePay API key:', apiKey);
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // SePay webhook actual format:
    //   id: transaction ID, transferAmount: amount,
    //   code: "DH{orderId}" (payment code prefix),
    //   subAccount: VA number, accountNumber: main account,
    //   content: raw description (bank may strip/truncate)
    const body = req.body;
    const transactionId = body.id || body.transactionId || body.transaction_id;
    const accountNumber = body.accountNumber || body.account_number;
    const amount = body.transferAmount || body.amount;
    const content = body.content || body.description || '';
    const transactionDate = body.transactionDate || body.transaction_date || body.date;
    const code = body.code || '';

    console.log('SePay webhook received full body:', JSON.stringify(req.body, null, 2));

    // Extract payment code from content (THANHTOAN + DH{orderId}{timestamp}, no dashes)
    let paymentCode = null;
    if (content) {
      const match = String(content).match(/THANHTOAN(DH\d+)/);
      if (match) paymentCode = match[1];
    }
    // Fallback: try the 'code' field (SePay may truncate it)
    if (!paymentCode && code) {
      const codeMatch = String(code).match(/^(DH.+)/);
      if (codeMatch) paymentCode = codeMatch[1];
    }

    console.log('SePay webhook parsed:', { transactionId, accountNumber, amount, content, transactionDate, code, paymentCode });

    if (!paymentCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment content',
        received: { content, transactionId, amount, accountNumber }
      });
    }

    // Find order by payment code (use LIKE because bank may strip dashes/truncate)
    const orderResult = await pool.query(
      `SELECT id, total_amount, payment_status FROM orders WHERE payment_code LIKE $1 || '%'`,
      [paymentCode]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Already paid
    if (order.payment_status === 'PAID') {
      return res.status(200).json({
        success: true,
        message: 'Order already paid'
      });
    }

    // Verify amount matches
    if (Number(amount) !== Number(order.total_amount)) {
      console.error('Amount mismatch:', { expected: order.total_amount, received: amount });
      return res.status(400).json({
        success: false,
        message: 'Amount mismatch'
      });
    }

    // Update order payment status
    await pool.query(
      `UPDATE orders
       SET payment_status = 'PAID',
           paid_at = $1,
           transaction_id = $2,
           status = 'CONFIRMED'
       WHERE id = $3`,
      [new Date(transactionDate || Date.now()), transactionId, order.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully'
    });

  } catch (error) {
    console.error('SePay webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// =========================================
// GET PAYMENT STATUS
// =========================================
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await pool.query(
      `SELECT id, payment_status, payment_code, payment_content, paid_at, transaction_id, total_amount, bank_id, bank_name, account_number
       FROM orders WHERE id = $1`,
      [orderId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200)
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .header('Pragma', 'no-cache')
      .header('Expires', '0')
      .json({
        success: true,
        data: order.rows[0]
      });

  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};