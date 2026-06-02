import { Router } from 'express';
import {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} from '../services/customerService.js';

const router = Router();

// GET /api/customers — list all
router.get('/', async (_req, res) => {
  try {
    const customers = await listCustomers();
    res.json(customers);
  } catch (err) {
    console.error('Failed to list customers:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// POST /api/customers — create new
router.post('/', async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Customer name is required' } });
    }
    const customer = await createCustomer({ id: id || name, name: name.trim() });
    res.status(201).json(customer);
  } catch (err) {
    if (err.message.includes('already exists')) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: err.message } });
    }
    console.error('Failed to create customer:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// GET /api/customers/:id — get one
router.get('/:id', async (req, res) => {
  try {
    const customer = await getCustomer(req.params.id);
    res.json(customer);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }
    console.error('Failed to get customer:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// PUT /api/customers/:id — update
router.put('/:id', async (req, res) => {
  try {
    const customer = await updateCustomer(req.params.id, req.body);
    res.json(customer);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }
    console.error('Failed to update customer:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteCustomer(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete customer:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

export default router;
