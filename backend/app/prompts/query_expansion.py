"""
Query Expansion Prompt for Semantic Search Enhancement
Uses LLM to expand search queries with synonyms, variations, and related terms
Optimized for user segment creation with logical separators (if, but, and, etc.)
"""


def QUERY_EXPANSION_PROMPT(query_text: str) -> str:
    """
    Generate prompt for expanding search queries to capture variations and synonyms.
    
    This helps semantic search find relevant transcripts even when:
    - Users use different terms (e.g., "yoga classes" vs "yoga sessions")
    - There are misspellings (e.g., "yiga" instead of "yoga")
    - Related concepts are used (e.g., "gym" vs "fitness center")
    - Logical separators are used (if, but, and, or, etc.) for user segment creation
    
    Args:
        query_text: Original user search query
    
    Returns:
        Formatted prompt string for LLM query expansion
    """
    return f"""You are a search query enhancement expert for a gym member feedback system specializing in user segment creation.

USER SEARCH QUERY: "{query_text}"

TASK: Expand and enhance this search query to capture all variations, synonyms, misspellings, and related terms optimized for semantic search using vector embeddings. The expanded query will be used to find conversation transcripts that match user segment criteria.

CRITICAL: Preserve logical structure and separators (if, but, and, or, not, etc.) while expanding each component independently.

GUIDELINES:
1. Preserve the core intent and logical structure - if query has "BUT", "AND", "OR", "IF", maintain these relationships
2. Expand each component independently:
   - "like the gym" → "enjoy gym, satisfied with gym, happy with fitness center, positive about workout facility"
   - "not happy with trainer" → "unhappy with trainer, dissatisfied with instructor, disappointed with personal trainer, frustrated with coach"
   - "trainers are bad" → "trainers are bad, trainers are terrible, instructors are bad, coaches are bad, trainers are awful, unhappy with trainers, dissatisfied with trainers"
3. For negative complaints or criticism, expand to include:
   - Negative adjectives: bad, terrible, awful, poor, not good, unsatisfactory, disappointing
   - Dissatisfaction phrases: unhappy with, dissatisfied with, disappointed with, frustrated with, complaints about
   - Related negative terms: rude, impolite, unprofessional, incompetent, unhelpful
4. Include synonyms and related terms for gym/fitness context:
   - "gym" → "fitness center, workout facility, training facility, gymnasium"
   - "trainer" → "instructor, personal trainer, coach, fitness trainer"
   - "equipment" → "machines, weights, cardio equipment, workout machines, gym equipment"
   - "classes" → "sessions, fitness classes, group classes, workout sessions"
5. Include common misspellings and variations
6. For rating/numeric queries: expand to include equivalent expressions:
   - "rating greater than 5" → "rating above 5, rating more than 5, score higher than 5, rated 6 or more, gave 6 or above"
7. Format for semantic search: The expanded query should be a natural language sentence that captures all variations, optimized for vector embedding similarity

FEW-SHOT EXAMPLES:

Example 1 - Simple Query with Positive Condition:
QUERY: "people who like the gym"
EXPANDED: "members who enjoy the gym, like the fitness center, are satisfied with the workout facility, happy with training facility, have positive feelings about gym, appreciate the gymnasium"
REASONING: Expanded "like" to synonyms (enjoy, satisfied, happy, positive) and "gym" to related terms (fitness center, workout facility, etc.)

Example 2 - Query with BUT (Negative Condition):
QUERY: "people who like the gym but are not happy with trainer"
EXPANDED: "members who enjoy the gym, like the fitness center, are satisfied with the workout facility, but are not happy with trainer, unhappy with instructor, dissatisfied with personal trainer, disappointed with coach, frustrated with fitness trainer"
REASONING: Expanded both positive (gym satisfaction) and negative (trainer dissatisfaction) components independently, maintaining the "but" logical separator

Example 3 - Query with AND (Multiple Conditions):
QUERY: "people who gave rating greater than 5 and dislike the equipment"
EXPANDED: "members who gave rating above 5, rating more than 5, score higher than 5, rated 6 or more, gave 6 or above, and dislike the equipment, don't like the machines, unhappy with weights, dissatisfied with cardio equipment, frustrated with workout machines, disappointed with gym equipment"
REASONING: Expanded numeric condition (rating > 5) to equivalent expressions and "dislike equipment" to various negative equipment sentiments, maintaining "and" logical separator

Example 4 - Query with IF (Conditional):
QUERY: "people who like yoga classes if they mention flexibility"
EXPANDED: "members who enjoy yoga classes, like yoga sessions, are interested in yoga practice, appreciate flexibility training, if they mention flexibility, talk about flexibility, discuss flexibility training, bring up flexibility work"
REASONING: Expanded both main condition (yoga classes) and conditional (flexibility mentions), maintaining "if" logical structure

Example 5 - Query with OR (Alternative Conditions):
QUERY: "people who like personal training or group classes"
EXPANDED: "members who enjoy personal training, like one-on-one training, appreciate individual coaching, or enjoy group classes, like fitness classes, appreciate group sessions, are interested in group workouts"
REASONING: Expanded both alternatives independently, maintaining "or" logical separator

Example 6 - Query with NOT (Exclusion):
QUERY: "people who like the gym but not the equipment"
EXPANDED: "members who enjoy the gym, like the fitness center, are satisfied with the workout facility, but do not like the equipment, are not happy with machines, dissatisfied with weights, disappointed with cardio equipment"
REASONING: Expanded positive condition (gym satisfaction) and negative condition (equipment dissatisfaction), maintaining "but not" logical structure

Example 7 - Complex Query (Multiple Logical Separators):
QUERY: "people who like yoga but are not happy with trainer and gave rating above 7"
EXPANDED: "members who enjoy yoga, like yoga classes, appreciate yoga sessions, but are not happy with trainer, unhappy with instructor, dissatisfied with personal trainer, and gave rating above 7, rated 8 or more, score higher than 7, gave 8 or above"
REASONING: Expanded all three components (positive yoga, negative trainer, high rating) independently, maintaining "but" and "and" logical separators

Example 8 - Rating-Based Query:
QUERY: "people who gave rating greater than 5"
EXPANDED: "members who gave rating above 5, rating more than 5, score higher than 5, rated 6 or more, gave 6 or above, provided rating 6 or higher, mentioned rating above 5"
REASONING: Expanded numeric condition to equivalent expressions that capture the same meaning

Example 9 - Pain Point Query:
QUERY: "people who complain about equipment"
EXPANDED: "members who complain about equipment, have issues with machines, express dissatisfaction with weights, mention problems with cardio equipment, report equipment problems, frustrated with workout machines, disappointed with gym equipment"
REASONING: Expanded "complain" to various negative expressions and "equipment" to related terms

Example 10 - Opportunity Query:
QUERY: "people who are interested in personal training"
EXPANDED: "members who are interested in personal training, want personal training, asking about one-on-one training, inquiring about individual coaching, would like personal trainer, considering personal training services"
REASONING: Expanded "interested" to various expressions of interest and "personal training" to related service terms

Example 11 - Simple Negative Complaint:
QUERY: "trainers are bad"
EXPANDED: "trainers are bad, trainers are terrible, trainers are not good, instructors are bad, coaches are bad, personal trainers are bad, trainers are awful, trainers are poor, unhappy with trainers, dissatisfied with trainers, disappointed with trainers, frustrated with trainers, trainers are incompetent, trainers are unhelpful"
REASONING: Expanded "trainers" to synonyms (instructors, coaches, personal trainers) and "bad" to various negative expressions (terrible, awful, poor, not good) plus related dissatisfaction phrases

Example 12 - Negative Complaint with Context:
QUERY: "trainers are rude"
EXPANDED: "trainers are rude, trainers are impolite, instructors are rude, coaches are rude, trainers are disrespectful, trainers are unfriendly, trainers are discourteous, trainers are unprofessional, trainers have bad attitude, trainers are harsh, trainers are mean"
REASONING: Expanded "trainers" to related terms and "rude" to various expressions of impoliteness and unprofessional behavior

FORMATTING RULES:
- Return ONLY the expanded query text, nothing else
- No explanations, no markdown, no code blocks
- The expanded query should be a natural language sentence optimized for semantic search
- Maintain logical separators (but, and, or, if, not) from the original query
- Keep it comprehensive but concise (2-4 sentences typically)

EXPANDED QUERY:"""


def QUERY_EXPANSION_SYSTEM_MESSAGE() -> str:
    """
    System message for the LLM when expanding queries for user segment creation.
    
    Returns:
        System message string
    """
    return """You are a search query enhancement expert specializing in user segment creation for gym member feedback systems. 
Your task is to expand search queries while preserving logical structure (if, but, and, or, not) and formatting the result for semantic search using vector embeddings.
Return ONLY the expanded query text, no explanations, no markdown, no additional text."""

