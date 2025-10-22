import express from 'express';
import bodyParser from 'body-parser';
// สำหรับ uuid ให้ใช้การ import โดยตรง
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 3000;

// Middleware
// ใช้ body-parser เพื่อ parse incoming JSON requests
app.use(bodyParser.json({ limit: '50mb' })); // ตั้งค่า limit ให้สูงขึ้นเพื่อรองรับข้อมูล base64 image

// In-memory data store (สำหรับจำลองการเก็บข้อมูลใน DB)
const vehicleDataStore = [];

// กำหนดโครงสร้างข้อมูลที่คาดหวังจาก Request Body
// (สำหรับการตรวจสอบเบื้องต้น แต่ Express ไม่ได้มี built-in schema validation)
// ในระบบจริงควรใช้ library เช่น Joi หรือ Zod เพื่อ validate ข้อมูล
const expectedDataSchema = [
    "crossingIndexCode", "datetime", "plate", "plate_province", 
    "total_axles", "total_length", "total_width", "outcome", 
    "total_weight", "weight_limit", "speed", "vehicle_type", 
    "vehicle_class", "lane", "overview_image", "plate_image"
];

// ----------------------------------------------------------------
// ## API Endpoints

/**
 * 1. POST /api/vehicle-data
 * - รับข้อมูลการข้ามผ่านของยานพาหนะตาม Specification
 * - ตรวจสอบความถูกต้องของข้อมูลเบื้องต้น
 * - กำหนด ID ให้กับข้อมูลและบันทึก
 */
app.post('/api/vehicle-data', (req, res) => {
    const newData = req.body;

    // Basic Validation: ตรวจสอบว่าข้อมูลหลักๆ ถูกส่งมาครบหรือไม่
    const missingFields = expectedDataSchema.filter(field => newData[field] === undefined);

    if (missingFields.length > 0) {
        return res.status(400).json({ 
            error: 'Invalid Data', 
            message: `Missing required fields: ${missingFields.join(', ')}` 
        });
    }

    // สร้าง ID ที่ไม่ซ้ำกัน
    const id = uuidv4();
    
    // โครงสร้างข้อมูลที่จัดเก็บ
    const vehicleRecord = {
        id, // เพิ่ม ID สำหรับการเรียกดู
        receivedAt: new Date().toISOString(), // เพิ่ม timestamp สำหรับการตรวจสอบ
        data: newData
    };

    // บันทึกข้อมูล
    vehicleDataStore.push(vehicleRecord);
    console.log(`[POST] New record added with ID: ${id}`);
    
    // ตอบกลับด้วย ID ของข้อมูลที่บันทึก
    res.status(201).json({ 
        message: 'Vehicle data successfully recorded', 
        id: id 
    });
});

// ----------------------------------------------------------------

/**
 * 2. GET /api/vehicle-data/:id
 * - ดึงข้อมูลการข้ามผ่านของยานพาหนะตาม ID
 */
app.get('/api/vehicle-data/:id', (req, res) => {
    const { id } = req.params;

    // ค้นหาข้อมูลจาก store
    const record = vehicleDataStore.find(rec => rec.id === id);

    if (!record) {
        // ถ้าไม่พบข้อมูล
        return res.status(404).json({ error: 'Not Found', message: `Record with ID ${id} not found.` });
    }

    // ตอบกลับด้วยข้อมูล
    res.status(200).json(record.data);
});

// ----------------------------------------------------------------

// Start Server
app.listen(port, () => {
    console.log(`Vehicle Data API listening at http://localhost:${port}`);
    console.log(`POST endpoint: /api/vehicle-data`);
    console.log(`GET endpoint: /api/vehicle-data/:id`);
});