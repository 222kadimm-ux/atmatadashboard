const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminToken = req.headers['x-admin-token'];
  if (!adminToken) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Service key not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const shopIds = [...new Set(data.map(r => r.shop_id))];
        const { data: shops } = await supabase
          .from('shops')
          .select('id, name, emoji, email')
          .in('id', shopIds);

        const shopsMap = {};
        (shops || []).forEach(s => { shopsMap[s.id] = s; });
        data.forEach(r => { r.shops = shopsMap[r.shop_id] || null; });
      }

      return res.status(200).json({ data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { receipt_id, status, shop_id, plan, amount, admin_note } = req.body;

      if (!receipt_id || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { error: receiptError } = await supabase
        .from('receipts')
        .update({
          status,
          admin_note: admin_note || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', receipt_id);

      if (receiptError) throw receiptError;

      if (status === 'approved' && shop_id && plan) {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        const limits = { basic: 100, pro: 999999 };

        await supabase
          .from('shops')
          .update({
            plan,
            subscription_status: 'active',
            subscription_start: new Date().toISOString(),
            subscription_end: endDate.toISOString(),
            orders_limit: limits[plan] || 100,
            orders_this_month: 0
          })
          .eq('id', shop_id);

        await supabase
          .from('subscriptions')
          .insert([{
            shop_id,
            plan,
            amount: amount || 0,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: endDate.toISOString(),
            payment_method: 'ccp_baridimob'
          }]);
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};