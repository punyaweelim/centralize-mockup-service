// netlify/functions/api.js

import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import serverless from 'serverless-http';

// ** Netlify Blobs ** (Global scope is assumed in Netlify Runtime)
// หาก Netlify Blobs ไม่ถูกเรียกใช้ใน global scope คุณอาจต้องใช้ import { getStore } from '@netlify/blobs'
const STORE_NAME = 'vehicle_data_store'; 

const app = express();

// Middleware: ใช้ body-parser สำหรับ JSON requests (เพิ่ม limit สำหรับ Base64 images)
// ⚠️ Note: 50mb is very large for a Serverless function. Netlify/Lambda limits may override this.
app.use(bodyParser.json({ limit: '50mb' })); 

// ----------------------------------------------------------------
// ## API Endpoints

/**
 * 1. POST /vehicle-data
 * - รับข้อมูลและเก็บใน Netlify Blobs
 */
app.post('/vehicle-data', async (req, res) => {
    const newData = req.body;
    const id = uuidv4();
    
    // โครงสร้างข้อมูลที่จัดเก็บ
    const vehicleRecord = {
        id, 
        receivedAt: new Date().toISOString(),
        data: newData
    };

    try {
        const store = getStore(STORE_NAME); 
        await store.set(id, JSON.stringify(vehicleRecord)); 

        // Log JSON structure for better analysis in Netlify logs
        console.log(JSON.stringify({
            level: 'INFO',
            event: 'RECORD_CREATED',
            id: id,
            store: STORE_NAME
        }));
        
        res.status(201).json({ 
            message: 'Vehicle data successfully recorded and stored in Netlify Blobs', 
            id: id 
        });

    } catch (error) {
        // Log Error details
        console.error(JSON.stringify({
            level: 'ERROR',
            event: 'BLOB_STORE_FAILED_POST',
            errorMessage: error.message,
            stack: error.stack
        }));
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: `Failed to store data in Blob store. Error: ${error.message}` 
        });
    }
});

// ----------------------------------------------------------------

/**
 * 2. GET /vehicle-data/:id
 * - ดึงข้อมูลตาม ID จาก Netlify Blobs
 */
app.get('/vehicle-data/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const store = getStore(STORE_NAME);
        const rawRecord = await store.get(id); 

        if (!rawRecord) {
            // Log 404
            console.warn(JSON.stringify({
                level: 'WARN',
                event: 'RECORD_NOT_FOUND',
                id: id
            }));
            return res.status(404).json({ error: 'Not Found', message: `Record with ID ${id} not found in Blob store.` });
        }
        
        const record = JSON.parse(rawRecord);

        console.log(JSON.stringify({
            level: 'INFO',
            event: 'RECORD_RETRIEVED',
            id: id
        }));
        res.status(200).json(record.data);

    } catch (error) {
        console.error(JSON.stringify({
            level: 'ERROR',
            event: 'BLOB_STORE_FAILED_GET',
            errorMessage: error.message,
            stack: error.stack
        }));
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: `Failed to retrieve data from Blob store. Error: ${error.message}` 
        });
    }
});


// ----------------------------------------------------------------
// ## Serverless Handler Wrapper (Critical Fix for 404)

// **สำคัญ:** แก้ไขปัญหา 404 โดยการระบุ basePath ที่ Netlify ใช้สำหรับ Function นี้
// 'api' คือชื่อไฟล์/ชื่อ Function ที่ถูก Deploy (e.g., api.js)
const handler = serverless(app, {
    basePath: '/.netlify/functions/api', 
});

// ส่งออก handler สำหรับ Netlify (ESM)
export { handler };