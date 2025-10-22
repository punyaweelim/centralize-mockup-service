// netlify/functions/api.js

import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
// import { get, set } from '@netlify/blobs'; // Blobs are automatically available via global scope
import serverless from 'serverless-http';

// ----------------------------------------------------------------
// ## Configuration and Setup

const app = express();

// Middleware: ใช้ body-parser สำหรับ JSON requests (เพิ่ม limit สำหรับ Base64 images)
app.use(bodyParser.json({ limit: '50mb' }));

// Netlify Blobs will be available via the global scope.
// เราจะใช้ชื่อ store ที่ตั้งค่าไว้ใน netlify.toml ภายใต้ [[blobs]]
// Note: ใน Netlify Functions เราจะเข้าถึง Blobs ได้ผ่าน environment/context.
// For standard usage, we'll try to rely on the global `getBlobStore` or similar mechanism
// or the library's recommended usage within a function environment. 

// **Simplified Blob Access** (Assuming global access or direct import works in the environment)
const STORE_NAME = 'vehicle_data_store'; // ชื่อ Blob Store ตามที่ตั้งค่าใน netlify.toml

// ----------------------------------------------------------------
// ## API Endpoints

/**
 * 1. POST /api/vehicle-data
 * - รับข้อมูลและเก็บใน Netlify Blobs
 */
app.post('/api/vehicle-data', async (req, res) => {
    console.log(JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message: `INTO POST /api/vehicle-data endpoint`,
    }));
    const newData = req.body;
    const id = uuidv4();

    // โครงสร้างข้อมูลที่จัดเก็บ
    const vehicleRecord = {
        id,
        receivedAt: new Date().toISOString(),
        data: newData
    };

    try {
        // **ใช้ Netlify Blobs เพื่อเก็บข้อมูล**
        // Key คือ ID, Value คือข้อมูล JSON
        // `getStore` function is usually available in the Netlify Functions runtime
        console.log(JSON.stringify({
            level: 'INFO',
            timestamp: new Date().toISOString(),
            event: 'RECORD_CREATED',
            id: id,
            message: `New vehicle record successfully added.`,
            crossingIndexCode: newData.crossingIndexCode
        }));
        const store = getStore(STORE_NAME);
        await store.set(id, JSON.stringify(vehicleRecord)); // Blobs set requires string or buffer

        // console.log(`[POST] New record added with ID: ${id} to ${STORE_NAME}`);

        res.status(201).json({
            message: 'Vehicle data successfully recorded and stored in Netlify Blobs',
            id: id
        });

    } catch (error) {
        console.error(JSON.stringify({
            level: 'ERROR',
            timestamp: new Date().toISOString(),
            event: 'BLOB_STORE_FAILED',
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack // ส่ง stack trace สำหรับการ Debug
        }));

        res.status(500).json({
            error: 'Internal Server Error',
            details: `Failed to store data in Blob store.`
        });
    }
});

// ----------------------------------------------------------------

/**
 * 2. GET /api/vehicle-data/:id
 * - ดึงข้อมูลตาม ID จาก Netlify Blobs
 */
app.get('/api/vehicle-data/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // **ใช้ Netlify Blobs เพื่อดึงข้อมูล**
        const store = getStore(STORE_NAME);
        const rawRecord = await store.get(id); // ดึงข้อมูลแบบ raw string

        if (!rawRecord) {
            // ถ้าไม่พบข้อมูล
            return res.status(404).json({ error: 'Not Found', message: `Record with ID ${id} not found in Blob store.` });
        }

        // แปลงข้อมูลจาก string กลับเป็น JSON
        const record = JSON.parse(rawRecord);

        // ตอบกลับด้วยข้อมูลจริง (record.data)
        res.status(200).json(record.data);

    } catch (error) {
        console.error('Error fetching data from Netlify Blobs:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: `Failed to retrieve data from Blob store. Error: ${error.message}`
        });
    }
});


// ----------------------------------------------------------------
// ## Serverless Handler Wrapper

// ใช้ serverless-http ในการแปลง Express App ให้เป็น Netlify Function handler
const handler = serverless(app);

// ส่งออก handler สำหรับ Netlify
export { handler };