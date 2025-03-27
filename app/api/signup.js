// pages/api/signup.js
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { name, email, password } = req.body;

    // Basic validation (expand as needed)
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // In a real-world scenario, hash the password before storing!
    const client = await clientPromise;
    const db = client.db("yourDatabaseName"); // change to your actual DB name

    // Check if a user already exists
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Insert new user into the "users" collection
    await db.collection("users").insertOne({ name, email, password, createdAt: new Date() });

    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error during signup:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
