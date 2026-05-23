import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import client from '../config/redis.js';
import { Resend } from 'resend';

const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
};

const generateAccessToken = (user) =>
    jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES }
    );

const generateRefreshToken = (user) =>
    jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES }
    );

const setAuthCookies = (res, user) => {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_COOKIE_MAX_AGE,
    });
};

const clearAuthCookies = (res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('token');
};

const toPublicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
});

export const register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const existUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

        if (existUser.rows.length > 0) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            "INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
            [name, email, hashedPassword, phone]
        );

        const user = newUser.rows[0];
        setAuthCookies(res, user);

        return res.status(201).json({
            message: "Account created successfully",
            user: toPublicUser(user),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({message: "Server error"});
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required"});
        }

        if (!password){
            return res.status(400).json({ message: "Password is required"});
        }

        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (user.rows.length === 0) {
            return res.status(400).json({ message: "Incorrect email address"});
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password);

        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect password"});
        }

        const currentUser = user.rows[0];
        setAuthCookies(res, currentUser);

        return res.status(200).json({
            message: "Logged in successfully",
            user: toPublicUser(currentUser),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
}

export const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: "Refresh token required" });
        }

        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );

        const user = await pool.query(
            "SELECT id, name, email, role FROM users WHERE id = $1",
            [decoded.userId]
        );

        if (user.rows.length === 0) {
            clearAuthCookies(res);
            return res.status(401).json({ message: "User not found" });
        }

        setAuthCookies(res, user.rows[0]);

        return res.status(200).json({
            message: "Token refreshed",
            user: toPublicUser(user.rows[0]),
        });
    } catch (error) {
        clearAuthCookies(res);
        return res.status(401).json({ message: "Invalid refresh token" });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await pool.query(
            "SELECT id, name, email, role FROM users WHERE id = $1",
            [req.user.userId]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ user: toPublicUser(user.rows[0]) });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const logout = (req, res) => {
  clearAuthCookies(res);
  res.status(200).json({
    message: "Logged out successfully",
  });
};

const resend = new Resend(process.env.RESEND_API_KEY);

export const forgotPassword  = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email){
            return res.status(400).json({ message: "Email is required"});
        }

        const user = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

        if (user.rows.length === 0) {
            return res.status(400).json({ message: "Email not found"});
        }

        // Tạo OTP 6 số
        const otp = crypto.randomInt(100000, 999999).toString();

        // Lưu OTP 5 phút
        await client.setEx(`otp:${email}`, 300, otp);

        // Lưu số lần nhập sai còn lại
        await client.setEx(`otp_attempts:${email}`, 300, "3");


        const data = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: email,
            subject: 'Reset Password OTP',
            html: `
                <h2>Password Reset</h2>
                <p>Your OTP code is:</p>
                <h1>${otp}</h1>
                <p>This OTP will expire in 5 minutes.</p>
            `,
        });

        return res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
}

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        if (!otp) {
            return res.status(400).json({ message: "OTP is required" });
        }

        const storeOtp = await client.get(`otp:${email}`);

        if (!storeOtp) {
            return res.status(400).json({ message: "OTP expired or invalid" });
        }

        let attempts = await client.get(`otp_attempts:${email}`);

        attempts = parseInt(attempts);

        if (otp !== storeOtp) {
            attempts -= 1;

            if (attempts <= 0) {
                await client.del(`otp:${email}`);
                await client.del(`otp_attempts:${email}`);
                return res.status(400).json({ message: "OTP expired due to too many failed attempts" });
            }
            await client.setEx(`otp_attempts:${email}`, 300, attempts.toString());
            return res.status(400).json({ message: `Incorrect OTP. You have ${attempts} attempts left` });
        }

        await client.setEx(`otp_verified:${email}`, 300, "true");

        return res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        if (!newPassword) {
            return res.status(400).json({ message: "New password is required" });
        }

        // Kiểm tra đã verify OTP chưa
        const verified = await client.get(`otp_verified:${email}`);

        if (!verified) {
            return res.status(400).json({ message: "OTP not verified" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPassword, email]);

        await client.del(`otp:${email}`);
        await client.del(`otp_attempts:${email}`);
        await client.del(`otp_verified:${email}`);

        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
}
