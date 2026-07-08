# TripBloom Free Deployment Guide: Render & Vercel

This guide provides step-by-step instructions to deploy the TripBloom platform (MERN stack) completely for free using **Render** (for the Node.js/Express backend) and **Vercel** (for the React/Vite frontend).

---

## 📋 Prerequisites
* A [GitHub](https://github.com) account.
* A [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) account (for a free cloud database).
* A [Render](https://render.com) account (for free backend hosting).
* A [Vercel](https://vercel.com) account (for free frontend hosting).

---

## 🚀 Step 1: Push Project to GitHub

Make sure your repository has all your latest local changes committed and pushed to GitHub:

```bash
# Check status
git status

# Stage and commit changes
git add .
git commit -m "Configure TripBloom for production deployment"

# Push to main branch
git push origin main
```

---

## 🍃 Step 2: Setup MongoDB Atlas (Free Cloud Database)

Since local MongoDB databases are not accessible in production, you must use a cloud database:

1. Sign in to your [MongoDB Atlas Dashboard](https://cloud.mongodb.com).
2. Click **Create** to deploy a new database cluster.
3. Select the **M0 (Free)** tier.
4. Choose a provider (e.g., AWS) and region close to your target users, then click **Create**.
5. Under **Security Quickstart**:
   * Create a database user (e.g., `db_user`) and set a strong password. Note these credentials.
   * Add `0.0.0.0/0` (Allow Access from Anywhere) to the **IP Access List**. Render's free tier uses dynamic IP addresses, so blocking individual IPs will break backend database connections.
6. Once the database is ready, click **Connect** → **Drivers**.
7. Copy your MongoDB connection string (looks like `mongodb+srv://<username>:<password>@cluster0...mongodb.net/?retryWrites=true&w=majority`).
8. Replace `<username>` and `<password>` with your created database credentials. Keep this string ready for the backend configuration.

---

## ⚙️ Step 3: Deploy Backend to Render (Free Web Service)

Render allows you to host web servers for free.

1. Sign in to [Render](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Select **Connect repository** and choose your `TripBloom` repository.
4. Configure the Web Service settings:
   * **Name**: `tripbloom-api` (or any unique name).
   * **Region**: Choose a region close to your MongoDB Atlas cluster.
   * **Branch**: `main`.
   * **Root Directory**: `backend`
   * **Runtime**: `Node`.
   * **Build Command**: `npm install`
   * **Start Command**: `node index.js`
   * **Instance Type**: Select the **Free** tier ($0/month).
5. Scroll down and click **Advanced** to add **Environment Variables**:
   * `MONGODB_URI` = `your_mongodb_atlas_connection_string` (from Step 2)
   * `JWT_SECRET` = `your_secure_random_jwt_secret_key` (generate a strong one)
   * `NODE_ENV` = `production`
   * `CORS_ORIGIN` = `https://your-deployed-frontend.vercel.app` (You can update this later once Vercel gives you a frontend URL)
6. Click **Create Web Service**.
7. Wait 2-5 minutes for the build to complete. Once finished, copy your Render Web Service URL (looks like `https://tripbloom-api.onrender.com`).

---

## 🎨 Step 4: Deploy Frontend to Vercel (Free React Hosting)

Vercel is optimized for frontend frameworks and offers fast, globally edge-cached static hosting.

1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your `TripBloom` GitHub repository.
4. Configure the project settings:
   * **Framework Preset**: Vite (detected automatically).
   * **Root Directory**: Click Edit and select the `frontend` folder.
   * **Build and Development Settings**: Leave as default.
5. Expand the **Environment Variables** section and add:
   * `VITE_API_URL` = `https://your-deployed-backend-api.onrender.com` (Paste the Render backend URL copied in Step 3).
6. Click **Deploy**.
7. Vercel will build and launch your frontend. Once completed, copy the generated `.vercel.app` URL.

---

## 🔗 Step 5: Link Frontend and Backend (CORS Alignment)

To allow the frontend to securely make API requests to your backend without encountering CORS blocks:

1. Return to your [Render Dashboard](https://dashboard.render.com).
2. Open your `tripbloom-api` backend web service.
3. Go to the **Environment** tab.
4. Update the `CORS_ORIGIN` environment variable with your new Vercel URL (e.g., `https://tripbloom.vercel.app`).
5. Save changes. Render will automatically redeploy your backend with the updated CORS policy.

---

## ⚙️ How Render Free Tier Works
Render puts free web services to sleep after 15 minutes of inactivity. When a user first loads your site after a period of inactivity, the first API request might experience a delay of 50-90 seconds while the backend server spins back up. Subsequent requests will load instantly.

---

## 🛠️ Production Checks & Troubleshooting

### Render Build / Start Fails
* Double-check that your **Root Directory** is configured to `backend`.
* Confirm that the **Start Command** is set to `node index.js`.

### 404/API Mismatch Errors
* Ensure that `VITE_API_URL` in Vercel does not end with a trailing slash `/` (use `https://your-api.onrender.com`, not `https://your-api.onrender.com/`).

### KYC Document Images Not Loading
* In production, since Render's disk storage is ephemeral, uploaded KYC document images will reset whenever the server restarts. For robust production scaling, update Multer upload handlers to store files in a cloud object store like Google Cloud Storage or AWS S3.
