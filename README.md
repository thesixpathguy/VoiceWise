# VoiceWise - Product & Technical Documentation

## 1. Product Research

### Problem Statement
Gym owners struggle to gather meaningful feedback from members at scale. Traditional methods (surveys, in-person conversations) are:
- Time-consuming and don't scale
- Low response rates
- Limited insights without AI analysis
- Hard to track sentiment and revenue opportunities

### Solution
VoiceWise automates member feedback collection through AI-powered phone calls, then extracts actionable insights using advanced LLM analysis.

### Target Market
- **Primary:** Small to medium-sized gyms (50-500 members)
- **Secondary:** Fitness franchises managing multiple locations
- **Tertiary:** Large gym chains needing centralized feedback systems

### Key Features
1. **Automated AI Calls:** Bland AI agent conducts natural conversations
2. **AI Analysis:** Groq LLM extracts sentiment, pain points, opportunities
3. **Revenue Detection:** Identifies members interested in premium services
4. **Semantic Search:** Find calls by natural language queries
5. **Dashboard Analytics:** Real-time insights and trend analysis

### Value Proposition
- **Time Savings:** Automate feedback collection (100+ calls/day)
- **Higher Engagement:** Phone calls get better response than surveys
- **Actionable Insights:** AI extracts specific pain points and opportunities
- **Revenue Growth:** Identify upsell opportunities automatically

---

## 2. Market Research

### Market Size
- **US Fitness Industry:** $35B+ annually, 64M gym members
- **Small/Medium Gyms:** ~30,000 facilities in US
- **Target Addressable Market:** ~$50M for feedback/analytics tools

### Competitive Landscape
- **SurveyMonkey/Typeform:** Generic surveys, no AI analysis, low response rates
- **Zendesk/Customer.io:** Built for support, not feedback collection
- **Custom Solutions:** Expensive ($50K+), long development cycles

### Competitive Advantages
1. **Voice-First Approach:** Higher engagement than text surveys
2. **AI-Powered Analysis:** Automatic insight extraction vs manual review
3. **Revenue Intelligence:** Identifies upsell opportunities automatically
4. **Semantic Search:** Natural language querying of call transcripts
5. **Affordable:** SaaS pricing vs custom development

### Market Positioning
**"The AI-powered voice feedback platform that helps gyms understand member sentiment and identify revenue opportunities automatically."**

### Pricing Strategy (Recommended)
- **Starter:** $99/mo - 100 calls/month
- **Professional:** $299/mo - 500 calls/month
- **Enterprise:** Custom pricing for unlimited calls

---

## 3. Technical System Design

### Architecture Overview
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│   FastAPI    │────▶│  Supabase   │
│  Frontend   │     │   Backend    │     │ PostgreSQL  │
└─────────────┘     └──────────────┘     └─────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
             ┌──────▼──────┐   ┌──────▼──────┐
             │  Bland AI   │   │   Groq LLM   │
             │  (Voice)    │   │  (Analysis)  │
             └─────────────┘   └─────────────┘
```

### Technology Stack

**Frontend:**
- React 19 + Vite
- Tailwind CSS
- Axios for API calls

**Backend:**
- FastAPI (Python)
- SQLAlchemy ORM
- Alembic migrations

**Database:**
- Supabase (PostgreSQL)
- pgvector extension for embeddings

**AI/ML:**
- Bland AI (voice calls)
- Groq LLM (llama-3.3-70b-versatile)
- Sentence Transformers (all-MiniLM-L6-v2)

### Data Models

**Call Entity:**
- `call_id`, `phone_number`, `gym_id`
- `raw_transcript`, `transcript_embedding` (384-dim vector)
- `status`, `duration_seconds`, timestamps

**Insight Entity:**
- `call_id` (FK, unique)
- `topics` (array), `sentiment`, `pain_points` (array)
- `opportunities` (array), `revenue_interest` (boolean)
- `revenue_interest_quote`, `confidence`, `gym rating`

### System Components

**1. Call Service Layer**
- Initiates batch calls via Bland AI API
- Manages call state (initiated → completed)
- Handles webhook updates

**2. AI Service Layer**
- Extracts insights using Groq LLM
- Uses structured prompts (chain-of-thought, few-shot)
- Returns structured JSON insights

**3. Search Service Layer**
- Generates embeddings (384-dim vectors)
- Semantic search via pgvector cosine similarity
- Hybrid search: phone, status, sentiment, NLP

**4. Insight Service Layer**
- Stores and aggregates insights
- Generates dashboard summaries
- Calculates sentiment distribution

### API Endpoints

**Call Management:**
- `POST /api/calls/initiate` - Batch call initiation
- `GET /api/calls` - List with filters
- `GET /api/calls/{call_id}` - Get details
- `DELETE /api/calls/{call_id}` - Delete call

**Analysis:**
- `POST /api/calls/{call_id}/analyze` - Manual analysis
- `GET /api/calls/{call_id}/insights` - Get insights

**Search & Analytics:**
- `GET /api/calls/search` - Hybrid search
- `GET /api/calls/dashboard/summary` - Dashboard data

**Webhooks:**
- `POST /api/webhooks/bland-ai` - Bland AI callbacks

### Data Flow

1. **Call Initiation:**
   - User → Frontend → API → CallService → Bland AI
   - Call stored with status "initiated"

2. **Call Completion:**
   - Bland AI → Webhook → Updates call status
   - Background task: AI analysis + embedding generation

3. **Analysis Process:**
   - Transcript → Groq LLM → Extract insights → Store
   - Transcript → Sentence Transformer → Generate embedding → Store

4. **User Access:**
   - Dashboard/Calls/Search pages → API → Return formatted data

### Security Considerations
- API keys stored in environment variables
- Supabase row-level security (if implemented)
- CORS configured for frontend origins
- Webhook payload validation

---

## 4. Implementation Details

### Setup Requirements

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

**Frontend:**
```bash
cd frontend
npm install
```

### Environment Configuration

**Backend `.env`:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
DATABASE_URL=postgresql://...
BLAND_AI_API_KEY=your_key
GROQ_API_KEY=your_key
BLAND_AI_WEBHOOK_URL=https://your-domain.com/api/webhooks/bland-ai
```

**Frontend `.env`:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000
```

### Database Schema

**Migrations:**
- Initial schema (calls, insights tables)
- Added `revenue_interest_quote` column
- Added `transcript_embedding` vector column (pgvector)

**Key Indexes:**
- `call_id` (unique)
- `phone_number`
- `gym_id`
- `sentiment`
- `revenue_interest`

### AI Prompt Engineering

**Call Script:**
- Natural conversation about gym experience
- Topics: satisfaction, equipment, staff, trainer interest
- 3-minute max duration

**Insight Extraction:**
- **Chain-of-Thought:** Multi-step reasoning
- **Few-Shot Learning:** Example patterns
- **Keyword Triggers:** Revenue interest detection
- **Structured Output:** JSON format enforcement

### Background Processing

**Webhook Handler:**
- Receives Bland AI callbacks
- Updates call status/transcript
- Triggers background task for completed calls

**Background Task:**
- Async insight extraction (Groq API)
- Embedding generation (Sentence Transformers)
- Database updates

### Search Implementation

**Hybrid Search Types:**
1. **Phone:** Exact/partial match on phone numbers
2. **Status:** Filter by call status
3. **Sentiment:** Filter by sentiment (requires JOIN)
4. **NLP:** Semantic search using vector similarity

**Semantic Search:**
- Query → Embedding → Cosine similarity search
- Threshold: 0.77 (configurable)
- Results ordered by similarity

### Frontend Components

**Pages:**
- **Home:** Landing page with feature overview
- **Dashboard:** Analytics, sentiment, pain points, quotes
- **Calls:** List all calls with details panel
- **Initiate:** Batch call initiation form
- **Search:** Hybrid search interface

**State Management:**
- React hooks (useState, useEffect)
- API calls via Axios
- Local state for UI interactions

### Scalability Considerations

**Current Limitations:**
- 30-second delay between call initiations (Bland AI rate limit)
- Synchronous embedding generation (could be batched)
- Single database instance

**Future Improvements:**
- Queue system for call initiation (Celery/RQ)
- Batch embedding generation
- Read replicas for database
- Caching layer (Redis) for dashboard data
- CDN for frontend assets

### Monitoring & Logging

**Current:**
- Console logging for debugging
- Error handling in API endpoints
- Health check endpoint (`/health`)

**Recommended:**
- Structured logging (JSON format)
- Error tracking (Sentry)
- Performance monitoring (DataDog/New Relic)
- Analytics for user behavior

---

## 5. Key Metrics & KPIs

### Product Metrics
- Calls initiated per day
- Call completion rate
- Average call duration
- Transcript quality score

### Business Metrics
- Revenue opportunities identified
- Sentiment distribution (positive/negative ratio)
- Pain points frequency
- User engagement (dashboard views)

### Technical Metrics
- API response time
- Background task processing time
- Embedding generation time
- Search query performance

---

## 6. Future Roadmap

### Short-term (1-3 months)
- Email notifications for new insights
- Export reports (PDF/CSV)
- Multi-gym dashboard views
- Call scheduling features

### Medium-term (3-6 months)
- Mobile app for gym owners
- Real-time call monitoring
- Advanced analytics (trends, predictions)
- Integration with gym management software

### Long-term (6-12 months)
- Multi-language support
- Voice tone analysis
- Automated action items
- Member retention predictions

---

## Conclusion

VoiceWise combines voice automation, AI analysis, and semantic search to provide gym owners with actionable member insights at scale. The architecture is scalable, the tech stack is modern, and the product solves a real pain point in the fitness industry.

**Key Differentiators:**
1. Voice-first approach (higher engagement)
2. AI-powered analysis (automatic insights)
3. Revenue intelligence (upsell detection)
4. Semantic search (natural language queries)

**Next Steps:**
- Beta testing with 5-10 gyms
- Gather feedback and iterate
- Build marketing website
- Launch on Product Hunt
