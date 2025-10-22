// netlify/functions/api.js

import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import serverless from 'serverless-http';
import { getStore } from '@netlify/blobs'; 

const STORE_NAME = 'vehicle_data_store'; 

// 💡 การกำหนดค่า Netlify Blobs Token
// เราจะดึงค่าจาก Environment Variables ที่ตั้งค่าไว้ใน Netlify UI
const NETLIFY_BLOB_TOKEN = "nfp_BB2BP4kWzj3TVrFjkncBho2uMXinNuJKc1d5";
const NETLIFY_SITE_ID = "b99de81e-5a17-4a38-8ea4-29abe1458c28";

const app = express();

// Middleware
app.use(bodyParser.json({ limit: '50mb' })); 

// ----------------------------------------------------------------
// ## ฟังก์ชันสำหรับเข้าถึง Store ที่มีการระบุ Config โดยตรง

const getVehicleStore = () => {
    // 🛑 ตรวจสอบว่า Environment Variables ครบหรือไม่
    if (!NETLIFY_BLOB_TOKEN || !NETLIFY_SITE_ID) {
        throw new Error("Missing required environment variables for Netlify Blobs: NETLIFY_SITE_ID or NETLIFY_BLOB_TOKEN.");
    }

    // ✅ ใช้โครงสร้างที่ระบุ Site ID และ Token โดยตรง
    return getStore(STORE_NAME, {
        siteID: NETLIFY_SITE_ID,
        token: NETLIFY_BLOB_TOKEN,
    });
};

// ----------------------------------------------------------------
// ## API Endpoints

/**
 * 1. POST /vehicle-data
 */
app.post('/vehicle-data', async (req, res) => {
    const newData = req.body;
    const id = uuidv4();
    const vehicleRecord = { id, receivedAt: new Date().toISOString(), data: newData };

    try {
        const store = getVehicleStore(); // ใช้ฟังก์ชันที่ระบุ Config โดยตรง
        await store.set(id, JSON.stringify(vehicleRecord)); 
        
        console.log(JSON.stringify({ level: 'INFO', event: 'RECORD_CREATED', id: id }));
        
        res.status(201).json({ 
            message: 'Vehicle data successfully recorded and stored in Netlify Blobs', 
            id: id 
        });

    } catch (error) {
        console.error(JSON.stringify({ level: 'ERROR', event: 'BLOB_STORE_FAILED_POST', errorMessage: error.message, stack: error.stack }));
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: `Failed to store data in Blob store. Error: ${error.message}` 
        });
    }
});

/**
 * 2. GET /vehicle-data/:id
 */
app.get('/vehicle-data/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const store = getVehicleStore(); // ใช้ฟังก์ชันที่ระบุ Config โดยตรง
        const rawRecord = await store.get(id); 

        if (!rawRecord) {
            console.warn(JSON.stringify({ level: 'WARN', event: 'RECORD_NOT_FOUND', id: id }));
            return res.status(404).json({ error: 'Not Found', message: `Record with ID ${id} not found in Blob store.` });
        }
        
        const record = JSON.parse(rawRecord);
        console.log(JSON.stringify({ level: 'INFO', event: 'RECORD_RETRIEVED', id: id }));
        res.status(200).json(record.data);

    } catch (error) {
        console.error(JSON.stringify({ level: 'ERROR', event: 'BLOB_STORE_FAILED_GET', errorMessage: error.message, stack: error.stack }));
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: `Failed to retrieve data from Blob store. Error: ${error.message}` 
        });
    }
});


// Serverless Handler Wrapper (ใช้ basePath เพื่อแก้ไขปัญหา 404)
const handler = serverless(app, {
    basePath: '/.netlify/functions/api', 
});

// ส่งออก handler สำหรับ Netlify (ESM)
export { handler };