import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
// import { sendVerificationEmail } from '../utils/email.js'; // disabled for testing

// ── Register Shop ─────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const {
      shopName, ownerName, mobile, email, password,
      address, gstNumber, businessType
    } = req.body;

    // Check duplicates
    const existing = await prisma.shop.findFirst({
      where: { OR: [{ email }, { mobile }] }
    });

    if (existing) {
      const field = existing.email === email ? 'Email' : 'Mobile number';
      return res.status(409).json({ error: `${field} already registered` });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const shop = await prisma.shop.create({
      data: {
        name: shopName,
        ownerName,
        mobile,
        email,
        passwordHash,
        address,
        gstNumber: gstNumber || null,
        businessType: businessType || 'RETAIL',
        isVerified: true, // auto-verify for testing (email disabled)
        // Create default settings
        settings: {
          create: {
            gstEnabled: true,
            invoicePrefix: 'INV',
            currencySymbol: '₹',
          }
        },
        subscription: {
          create: { plan: 'FREE' }
        },
        // Create main branch
        branches: {
          create: {
            name: shopName,
            address,
            mobile,
            isMain: true,
          }
        }
      },
      select: { id: true, name: true, email: true }
    });

    // Email verification disabled for testing

    res.status(201).json({
      message: 'Account created! You can now login.',
      shopId: shop.id,
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const shop = await prisma.shop.findUnique({
      where: { email },
      include: { settings: true, subscription: true }
    });

    if (!shop) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Email verification check disabled for testing
    // if (!shop.isVerified) {
    //   return res.status(403).json({ error: 'Please verify your email first' });
    // }

    if (!shop.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    const validPassword = await bcrypt.compare(password, shop.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { shopId: shop.id, type: 'shop' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      shop: {
        id: shop.id,
        name: shop.name,
        ownerName: shop.ownerName,
        email: shop.email,
        mobile: shop.mobile,
        logo: shop.logo,
        businessType: shop.businessType,
        gstNumber: shop.gstNumber,
        settings: shop.settings,
        subscription: shop.subscription,
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── Staff Login ───────────────────────────────────────────
export const staffLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const staff = await prisma.staff.findUnique({
      where: { email },
      include: { shop: { select: { id: true, name: true, logo: true } } }
    });

    if (!staff || !staff.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, staff.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { staffId: staff.id, shopId: staff.shopId, type: 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        shopId: staff.shopId,
        shop: staff.shop,
      }
    });
  } catch (err) {
    next(err);
  }
};

// ── Verify Email ──────────────────────────────────────────
export const verifyEmail = async (req, res, next) => {
  try {
    const { token, shopId } = req.query;

    // In production, verify token from Redis/DB
    // For now, just activate the shop
    await prisma.shop.update({
      where: { id: shopId },
      data: { isVerified: true }
    });

    res.json({ message: 'Email verified successfully! You can now login.' });
  } catch (err) {
    next(err);
  }
};

// ── Get Current User ──────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: {
        id: true, name: true, ownerName: true, email: true,
        mobile: true, logo: true, address: true, gstNumber: true,
        businessType: true, settings: true, subscription: true,
        _count: { select: { products: true, customers: true, suppliers: true } }
      }
    });

    res.json(shop);
  } catch (err) {
    next(err);
  }
};

// ── Change Password ───────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });

    const valid = await bcrypt.compare(currentPassword, shop.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.shop.update({
      where: { id: req.shopId },
      data: { passwordHash }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};
