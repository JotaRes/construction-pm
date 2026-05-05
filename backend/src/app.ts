import 'dotenv/config'
// pdf-parse v1.1.1
import express from 'express'
import cors from 'cors'
import path from 'path'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import phaseRoutes from './routes/phases'
import itemRoutes from './routes/items'
import drawRoutes from './routes/draws'
import providerRoutes from './routes/providers'
import inspectionRoutes from './routes/inspections'
import noteRoutes from './routes/notes'
import fileRoutes from './routes/files'
import alertRoutes from './routes/alerts'
import taskRoutes from './routes/tasks'
import budgetLineRoutes from './routes/budgetLines'
import priceRefRoutes from './routes/priceRefs'
import itemDocumentRoutes from './routes/itemDocuments'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/projects', phaseRoutes)
app.use('/api/projects', itemRoutes)
app.use('/api/projects', drawRoutes)
app.use('/api/projects', providerRoutes)
app.use('/api/projects', inspectionRoutes)
app.use('/api/projects', noteRoutes)
app.use('/api/projects', fileRoutes)
app.use('/api/projects', alertRoutes)
app.use('/api/projects', taskRoutes)
app.use('/api/projects', budgetLineRoutes)
app.use('/api/price-refs', priceRefRoutes)
app.use('/api/items', itemDocumentRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/draws', drawRoutes)
app.use('/api/inspections', inspectionRoutes)
app.use('/api/notes', noteRoutes)
app.use('/api/files', fileRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Construction PM API running on http://localhost:${PORT}`)
})

export default app
