// netlify/functions/api.js

import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import serverless from 'serverless-http';

// 💡 การแก้ไขที่สำคัญ: ต้อง Import getStore อย่างชัดเจน
import { getStore } from '@netlify/blobs'; 

const STORE_NAME = 'vehicle_data_store'; 

const app = express();

// Middleware
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
        // ✅ ตอนนี้ getStore ถูก Import และใช้งานได้แล้ว
        const store = getStore(STORE_NAME); 
        await store.set(id, JSON.stringify(vehicleRecord)); 

        // Log
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
        // ✅ getStore ใช้งานได้แล้ว
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

// Serverless Handler Wrapper (ใช้ basePath เพื่อแก้ไขปัญหา 404)
const handler = serverless(app, {
    basePath: '/.netlify/functions/api', 
});

// ส่งออก handler สำหรับ Netlify (ESM)
export { handler };