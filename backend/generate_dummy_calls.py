"""
Script to generate realistic dummy call entries for testing
Creates 200+ calls with varied transcripts, ratings, revenue interest, etc.
"""
import random
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import Call
from app.services.search_service import SearchService


# Conversation templates for realistic variety
INTRODUCTIONS = [
    "Hi, this is Alex calling from your gym. I wanted to check in and see how you're enjoying your membership.",
    "Hello! This is Alex from your gym. We're reaching out to gather some feedback about your experience.",
    "Hey there! Alex here from your gym. Just wanted to follow up and see how things are going for you.",
    "Good day! This is Alex from your gym. We're doing a quick check-in with members to see how their experience has been.",
    "Hi there! Alex here, calling from your gym. I hope you're doing well. We'd love to hear about your experience so far.",
    "Hello! This is Alex from your gym. Just checking in to see how everything's been going for you.",
]

POSITIVE_RESPONSES = [
    "Oh, it's been great actually! I really love the equipment and the trainers are super helpful.",
    "Yeah, I'm pretty happy with it. The facilities are clean and I like the variety of equipment.",
    "It's been good! I've been coming regularly and I'm seeing some progress, which is awesome.",
    "I'm really enjoying it. The staff is friendly and the atmosphere is motivating.",
    "Love it! The gym has everything I need and the location is convenient for me.",
    "It's fantastic! I've been going for three months now and I've lost 15 pounds. The trainers are amazing.",
    "Really enjoying it! The group classes are great and I've made some good friends here.",
    "It's been wonderful. I've seen such improvement in my strength and the environment is so positive.",
    "I'm very happy with it. The equipment is top-notch and the staff is always there when you need help.",
    "Great experience so far. I've been hitting my fitness goals and the facilities are always clean and well-maintained.",
    "Absolutely loving it! The variety of equipment and classes keeps me motivated to come every day.",
    "It's been excellent. I've noticed significant improvements in my cardio and overall fitness.",
]

NEUTRAL_RESPONSES = [
    "It's okay, I guess. Nothing too special but nothing terrible either.",
    "It's fine. I mean, I go there, do my workout, and leave. Pretty standard.",
    "Eh, it's alright. Could be better, could be worse, you know?",
    "It's acceptable. I don't have major complaints but also nothing that really stands out.",
    "It's decent. Gets the job done.",
    "It's fine. I go three times a week, do my thing, and that's about it.",
    "It's okay. Nothing groundbreaking but it serves its purpose.",
    "I mean, it's a gym. Does what I need it to do, nothing more, nothing less.",
    "It's satisfactory. I don't have any strong feelings about it either way.",
    "Pretty standard gym experience. Nothing to write home about but also no major issues.",
]

NEGATIVE_RESPONSES = [
    "Honestly, I've had some issues. The equipment is often broken and it's really frustrating.",
    "Not great. It's been crowded lately and the staff doesn't seem to care much.",
    "I've been disappointed. The cleanliness isn't what I expected and equipment maintenance is poor.",
    "It's been rough. Had some problems with billing and the facilities aren't well maintained.",
    "Not satisfied. The trainers aren't very knowledgeable and the equipment is outdated.",
    "It's been pretty frustrating. The locker rooms are always a mess and machines are constantly out of order.",
    "I'm not too happy. The gym is always overcrowded during the times I want to work out.",
    "It's disappointing. I expected better for what I'm paying monthly.",
    "Not impressed at all. The equipment is old and several machines have been broken for weeks.",
    "It's been problematic. Had issues with my membership billing and customer service wasn't helpful.",
    "Pretty dissatisfied. The trainers don't seem to know what they're doing and I don't feel safe.",
    "I'm considering canceling. Too many broken promises and the facilities aren't what was advertised.",
]

EQUIPMENT_TOPICS = [
    "The equipment is pretty good, though I wish there were more squat racks available during peak hours.",
    "I love the variety of machines. The new cardio equipment is especially nice.",
    "Some of the machines are broken or need maintenance. That's been a bit annoying.",
    "The equipment selection is decent, but it could use more free weights.",
    "Everything seems well maintained, which I really appreciate.",
    "The free weights section is great, but the cardio machines could use an upgrade.",
    "I really like the cable machines. They're modern and well-maintained.",
    "The equipment is okay, but I wish there were more Olympic lifting platforms.",
    "Some of the treadmills have been out of order for a while now.",
    "I appreciate the variety, especially the functional training area with battle ropes and sleds.",
    "The equipment is solid. I like that you have both machines and free weights.",
    "Could use more benches. Always waiting for a spot during peak hours.",
    "The weight machines are good but some are starting to show wear.",
    "I love the TRX stations and the pull-up bars are well positioned.",
    # Negative equipment feedback
    "The equipment is really outdated. Most machines are from like ten years ago and showing their age.",
    "Several machines have been broken for weeks and nothing's been fixed. It's really frustrating when I plan my workout.",
    "The equipment is poorly maintained. I've seen rust on some machines and frayed cables which is unsafe.",
    "There's not enough equipment for the number of members. Always crowded and long waits for basic machines.",
    "The equipment quality is poor. Weights are chipped, machines squeak, and nothing feels sturdy or safe to use.",
]

STAFF_TOPICS = [
    "The staff is super friendly and always willing to help. Really makes a difference.",
    "I don't interact with staff much, but when I do, they're professional.",
    "The trainers seem knowledgeable, though I haven't worked with one personally.",
    "Staff could be more present. Sometimes questions go unanswered.",
    "I had a great experience with one of the trainers. Really helpful with form.",
    "The front desk staff is always welcoming and remembers my name, which is nice.",
    "Some trainers seem more engaged than others, but overall they're okay.",
    "I've noticed the staff is really good about cleaning equipment between uses.",
    "The trainers seem knowledgeable but I haven't had a chance to work with them yet.",
    "Staff is courteous but sometimes seems understaffed during busy times.",
    "I had a consultation with a trainer who was very helpful in setting up a program.",
    "The staff keeps to themselves mostly, which I prefer actually.",
    "Trainers are approachable and always happy to answer questions about exercises.",
    "Some staff members are more helpful than others, but overall it's fine.",
    # Negative staff feedback
    "The staff is really unfriendly. They never smile and seem like they don't want to be there.",
    "I tried to ask a trainer for help and they were rude and dismissive. Made me feel unwelcome.",
    "The staff is never around when you need them. I've had to figure things out on my own.",
    "Some trainers give really bad advice. I've seen them teaching incorrect form that could cause injuries.",
    "The front desk staff is unprofessional. They're always on their phones and don't acknowledge members.",
]

PROGRESS_GOALS_DISCUSSION = [
    "I've been working on building strength and I've already increased my bench press by 30 pounds.",
    "My goal is to lose 20 pounds before my wedding in three months. I'm about halfway there!",
    "I'm training for a marathon, so I've been focusing on improving my endurance and stamina.",
    "I've been coming five days a week and I've noticed my energy levels have improved so much.",
    "My goal was to gain muscle mass and I've put on about 10 pounds of lean muscle in the past six months.",
    "I'm trying to get back in shape after an injury. The trainers have been great with modifications.",
    "I've lost 25 pounds since joining and I'm feeling stronger than I have in years.",
    "I'm preparing for a powerlifting competition, so I'm really focused on my big three lifts.",
    "My goal is to run a 5K without stopping. I'm up to about 2 miles now without a break.",
    "I've been working with a trainer on functional movement and my back pain has improved significantly.",
    "I'm trying to maintain my fitness level as I get older. The gym has been great for that.",
    "I've gained about 8 pounds of muscle and I'm really happy with the progress I'm seeing.",
    "My goal is just to be healthier overall. I've been coming regularly and I feel so much better.",
    "I'm training for a triathlon, so I'm using the pool, bikes, and doing strength training.",
    "I've been doing a combination of strength and cardio, and I've seen great results in my body composition.",
    "I'm focusing on flexibility and mobility. The yoga classes have been really helpful.",
    "I've been coming for six months and I've gone from barely lifting 50 pounds to deadlifting 200.",
    "My goal is to get stronger for my job which requires a lot of physical activity.",
    "I've been consistent for three months now and I'm starting to see definition I haven't had in years.",
    "I'm working on rehabilitating my knee after surgery. The trainers have been so supportive.",
    # Negative progress/goals feedback
    "Honestly, I haven't seen much progress. I've been coming for months but nothing seems to be changing.",
    "My goal was to lose weight but I haven't lost anything. I'm starting to think the gym isn't helping.",
    "I've been trying to build strength but I keep hitting plateaus. Not sure if it's the equipment or my routine.",
    "I'm not really seeing the results I wanted. Maybe I need better guidance but the trainers don't seem available.",
    "I've been coming regularly but I feel like I'm not making progress towards my goals. It's frustrating.",
]

REVENUE_INTEREST_PHRASES = [
    "You know what, I've actually been thinking about getting a personal trainer. Do you have any recommendations?",
    "I'm interested in the nutrition counseling program. Can you tell me more about that?",
    "I've been considering joining some of the group classes. What classes do you offer?",
    "I'd love to learn more about personal training packages. Are there different options?",
    "Yeah, I think I'd benefit from some one-on-one training. What are the rates like?",
    "I'm definitely interested in upgrading my membership to get access to more classes.",
    "Do you have any wellness programs or nutrition plans? I'm really interested in that.",
    "I've been thinking about getting a personal trainer for the next few months to really push my progress.",
    "Are there any premium membership options that include personal training sessions?",
    "I'd like to know more about your nutritionist services. Can you connect me with someone?",
    "I'm interested in the small group training classes. How do I sign up?",
    "I've been considering personal training. What's the process to get matched with a trainer?",
    "Do you offer meal planning or nutrition consultation services? That would be really helpful.",
    "I'm looking to upgrade to a membership that includes more classes and maybe some training sessions.",
    "I'd love to work with a trainer a few times a week. What packages do you offer?",
    "Are there any specialized programs for athletes? I'd be interested in something like that.",
    # Negative revenue interest (showing lack of interest or complaints about pricing)
    "I've thought about personal training but it's way too expensive. I can't afford it.",
    "I was interested in classes but heard they're always overcrowded, so I'm not sure it's worth the upgrade.",
    "I looked into nutrition counseling but the prices are ridiculous. I'll just figure it out myself.",
    "I considered upgrading my membership but honestly, the basic membership doesn't even justify what I'm paying, so why would I pay more?",
    "I've seen the personal training prices and they're not worth it. The trainers I've seen here don't seem very qualified anyway.",
]

IMPROVEMENT_TOPICS = [
    "The air quality in the gym isn't great. It feels stuffy and I wish there was better ventilation.",
    "There's a sewage smell near the gym entrance sometimes. It's really off-putting when I'm trying to work out.",
    "The lighting in the gym is too dim in some areas. I have trouble seeing what I'm doing in the weight section.",
    "The street outside the gym needs cleaning. There's trash and debris that makes the area look unprofessional.",
    "The parking lot lighting is terrible at night. I don't feel safe walking to my car after evening workouts.",
    "The air conditioning doesn't work well. It gets really hot and humid, especially during peak hours.",
    "There's construction noise from next door that's really distracting when I'm trying to focus on my workout.",
    "The gym entrance area smells like mold or something damp. It's not a great first impression.",
    "The street parking is always full and there's not enough spaces. I have to park blocks away sometimes.",
    "The noise from the street traffic is really loud. It would be nice to have better soundproofing.",
]

RATING_WITH_REASONS = {
    9: ["I'd give it a 9 out of 10. It's almost perfect, just wish parking was easier.", "9 out of 10. Really love everything about it, just minor things.", "I'd rate it a 9. Great gym, great staff, really happy overall."],
    10: ["Definitely a 10! Best gym I've been to. Everything is top notch.", "10 out of 10. Can't think of anything I'd change.", "It's a perfect 10 for me. Love everything about it."],
    8: ["I'd say an 8. Very good overall, just a few things that could be better.", "8 out of 10. Solid gym with good facilities.", "Rating of 8. Pretty satisfied, minor improvements could make it perfect."],
    7: ["I'd give it a 7. It's good, nothing amazing but gets the job done.", "7 out of 10. Decent place, has what I need.", "Rating of 7. It's fine, could use some improvements."],
    6: ["Maybe a 6. It's okay but there are definitely areas for improvement.", "I'd rate it 6 out of 10. Not bad, not great.", "6. It's acceptable but I've seen better gyms."],
    5: ["Probably a 5. It's average, nothing special about it.", "I'd give it a 5 out of 10. It's mediocre at best.", "Rating of 5. Middle of the road, neither good nor bad."],
    4: ["I'd say 4 out of 10. Not very happy with some aspects.", "Rating of 4. Below average, needs work.", "4 out of 10. Disappointed with several things."],
    3: ["Maybe a 3. I've had quite a few problems.", "I'd rate it 3 out of 10. Not satisfied at all.", "Rating of 3. Pretty poor experience honestly."],
    2: ["2 out of 10. Very disappointed with the service and facilities.", "I'd give it a 2. Almost everything needs improvement.", "Rating of 2. Very poor, wouldn't recommend."],
    1: ["1 out of 10. Worst gym experience I've had.", "I'd rate it 1. Terrible in almost every way.", "Rating of 1. Completely unsatisfied."],
}

NON_RATING_RESPONSES = [
    "I haven't really thought about rating it, but overall I'm pretty happy.",
    "I don't know, I guess I'm satisfied? It works for me.",
    "Hard to say. I haven't been going long enough to really judge.",
    "I'm still new, so I can't really give a rating yet.",
    "I prefer not to rate it, but I have no major complaints.",
]


def generate_transcript(rating_probability=0.7, revenue_interest_probability=0.3, include_progress=True) -> Tuple[str, Optional[int], bool, Optional[str]]:
    """
    Generate a realistic conversation transcript between Alex and a gym member.
    
    Returns:
        tuple: (transcript, rating, has_revenue_interest, revenue_quote)
    """
    # Alex introduces himself
    introduction = random.choice(INTRODUCTIONS)
    transcript_parts = [f"Alex: {introduction}"]
    
    # Member's initial response (determines sentiment direction)
    sentiment_roll = random.random()
    if sentiment_roll < 0.4:
        # Positive
        member_response = random.choice(POSITIVE_RESPONSES)
        sentiment = "positive"
    elif sentiment_roll < 0.7:
        # Neutral
        member_response = random.choice(NEUTRAL_RESPONSES)
        sentiment = "neutral"
    else:
        # Negative
        member_response = random.choice(NEGATIVE_RESPONSES)
        sentiment = "negative"
    
    transcript_parts.append(f"Member: {member_response}")
    
    # Topic 1: Overall satisfaction with facilities and services (already covered in initial response)
    # Topic 2: Quality of equipment and cleanliness
    alex_equipment_questions = [
        "That's helpful to know! Can you tell me more about the quality of our equipment and how clean you find the facilities?",
        "Thank you for sharing that. How would you describe the equipment quality and the overall cleanliness of the gym?",
        "I appreciate your feedback! What's your take on our equipment and the cleanliness standards?",
    ]
    transcript_parts.append(f"Alex: {random.choice(alex_equipment_questions)}")
    
    # Member discusses equipment (sometimes includes improvement topics)
    if random.random() < 0.2:  # 20% chance to mention improvement topic with equipment
        improvement_topic = random.choice(IMPROVEMENT_TOPICS)
        transcript_parts.append(f"Member: {improvement_topic}")
        transcript_parts.append("Alex: I understand. What about the equipment itself?")
    
    equipment_topic = random.choice(EQUIPMENT_TOPICS)
    transcript_parts.append(f"Member: {equipment_topic}")
    
    # Topic 3: Experience with staff and trainers
    alex_staff_questions = [
        "Great feedback! How has your experience been with our staff and trainers?",
        "Thank you! What's been your experience interacting with our staff and trainers?",
        "I appreciate that insight. How would you describe your interactions with our staff and trainers?",
    ]
    transcript_parts.append(f"Alex: {random.choice(alex_staff_questions)}")
    
    # Member discusses staff
    staff_topic = random.choice(STAFF_TOPICS)
    transcript_parts.append(f"Member: {staff_topic}")
    
    # Topic 4: Interest in additional services (personal training, classes, nutrition counseling)
    alex_services_questions = [
        "That's good to hear! Are you interested in any additional services we offer, like personal training, group classes, or nutrition counseling?",
        "Wonderful! Have you thought about trying any of our additional services - maybe personal training, classes, or nutrition programs?",
        "Thanks for that feedback! We also offer personal training, group classes, and nutrition counseling. Are any of those something you'd be interested in?",
    ]
    has_revenue_interest = random.random() < revenue_interest_probability
    revenue_quote = None
    
    if random.random() < 0.5:  # 50% chance Alex asks about services
        transcript_parts.append(f"Alex: {random.choice(alex_services_questions)}")
        if has_revenue_interest:
            revenue_phrase = random.choice([p for p in REVENUE_INTEREST_PHRASES if "I've thought" not in p and "I was interested" not in p and "I looked into" not in p and "I considered" not in p and "I've seen" not in p])  # Exclude negative ones
            transcript_parts.append(f"Member: {revenue_phrase}")
            revenue_quote = revenue_phrase
            transcript_parts.append("Alex: Absolutely! Let me connect you with someone who can provide more details about that.")
        else:
            no_interest_responses = [
                "Not really, I'm fine with just the basic membership for now.",
                "Maybe later, but I'm good with what I have currently.",
                "I haven't really thought about it, but I'll keep it in mind.",
            ]
            transcript_parts.append(f"Member: {random.choice(no_interest_responses)}")
    elif has_revenue_interest:
        # Member mentions it unprompted
        revenue_phrase = random.choice([p for p in REVENUE_INTEREST_PHRASES if "I've thought" not in p and "I was interested" not in p and "I looked into" not in p and "I considered" not in p and "I've seen" not in p])
        transcript_parts.append(f"Member: {revenue_phrase}")
        revenue_quote = revenue_phrase
        transcript_parts.append("Alex: That's great! Let me connect you with someone who can provide more details about that.")
    
    # Topic 5: Concerns, suggestions, or improvements
    alex_improvements_questions = [
        "I really value your feedback. Are there any concerns, suggestions, or improvements you'd like to see?",
        "Thank you for sharing all that. Do you have any concerns or suggestions for how we could improve?",
        "Your feedback is really important to us. Is there anything you'd like to see improved or changed?",
    ]
    if random.random() < 0.6:  # 60% chance to discuss improvements
        transcript_parts.append(f"Alex: {random.choice(alex_improvements_questions)}")
        if random.random() < 0.5:
            # Use improvement topic
            improvement_topic = random.choice(IMPROVEMENT_TOPICS)
            transcript_parts.append(f"Member: {improvement_topic}")
        else:
            # Use generic improvement response
            generic_improvements = [
                "Maybe just keep the equipment maintenance up to date.",
                "I think more parking would be helpful.",
                "Nothing major, just keep doing what you're doing.",
                "Maybe add more water fountains around the gym.",
            ]
            transcript_parts.append(f"Member: {random.choice(generic_improvements)}")
        transcript_parts.append("Alex: Thank you for that feedback, I'll definitely pass that along.")
    
    # Topic 6: Fitness goals and how gym is helping achieve them
    alex_goals_questions = [
        "I'd love to know more about your fitness journey. What are your current fitness goals and how is the gym helping you achieve them?",
        "That's really helpful feedback. What are your personal fitness goals and how do you feel the gym is supporting you in reaching them?",
        "Thank you for sharing that. Can you tell me about your fitness goals and how the gym is helping you work towards them?",
    ]
    if include_progress and random.random() < 0.7:  # 70% chance to discuss goals
        transcript_parts.append(f"Alex: {random.choice(alex_goals_questions)}")
        progress_discussion = random.choice(PROGRESS_GOALS_DISCUSSION)
        transcript_parts.append(f"Member: {progress_discussion}")
        transcript_parts.append("Alex: That's fantastic progress! Keep up the great work.")
    
    # Topic 7: Ask them to rate the gym on a scale of 1-10 and why they gave that rating
    alex_rating_questions = [
        "I really appreciate you taking the time to share your thoughts. On a scale of 1 to 10, how would you rate the gym overall, and what led you to give that rating?",
        "Thank you for all that great feedback. If you had to rate the gym on a scale of 1 to 10, what would you give it and why?",
        "I've learned a lot from our conversation. On a scale of 1 to 10, how would you rate your overall experience with the gym, and what influenced that rating?",
    ]
    
    rating = None
    if random.random() < rating_probability:
        # Alex asks for rating
        transcript_parts.append(f"Alex: {random.choice(alex_rating_questions)}")
        # They provide a rating
        if sentiment == "positive":
            rating = random.choice([8, 9, 10])
        elif sentiment == "neutral":
            rating = random.choice([5, 6, 7])
        else:
            rating = random.choice([1, 2, 3, 4])
        
        rating_quote = random.choice(RATING_WITH_REASONS[rating])
        transcript_parts.append(f"Member: {rating_quote}")
    else:
        # Alex asks but member doesn't provide rating
        transcript_parts.append(f"Alex: {random.choice(alex_rating_questions)}")
        no_rating_response = random.choice(NON_RATING_RESPONSES)
        transcript_parts.append(f"Member: {no_rating_response}")
    
    # Closing
    transcript_parts.append("Alex: Thank you so much for your time and feedback! We really appreciate it.")
    transcript_parts.append("Member: No problem, thanks for checking in!")
    transcript_parts.append("Alex: Have a great day!")
    
    transcript = " ".join(transcript_parts)
    return transcript, rating, has_revenue_interest, revenue_quote


def generate_phone_number() -> str:
    """Generate a random US phone number"""
    area_code = random.randint(200, 999)
    exchange = random.randint(200, 999)
    number = random.randint(1000, 9999)
    return f"+1{area_code}{exchange}{number}"


def generate_call_id(index: int, prefix: str = "call_dummy") -> str:
    """Generate a unique call ID"""
    # Add timestamp to ensure uniqueness even if script is run multiple times
    timestamp = int(datetime.now().timestamp())
    return f"{prefix}_{timestamp}_{index:06d}"


def generate_random_date_in_past_month() -> datetime:
    """Generate a random datetime within the past month"""
    now = datetime.now()
    days_ago = random.randint(0, 30)
    hours_ago = random.randint(0, 23)
    minutes_ago = random.randint(0, 59)
    
    return now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)


def generate_duration() -> int:
    """Generate a random call duration in seconds (60-180 seconds typical)"""
    return random.randint(60, 180)


def insert_dummy_calls(num_calls: int = 200):
    """Generate and insert dummy calls into the database"""
    db: Session = SessionLocal()
    search_service = SearchService(db)
    
    try:
        print(f"🚀 Generating {num_calls} dummy calls...")
        
        for i in range(1, num_calls + 1):
            # Generate transcript and metadata
            transcript, rating, has_revenue_interest, revenue_quote = generate_transcript(
                rating_probability=0.7,
                revenue_interest_probability=0.3
            )
            
            # Generate embedding
            print(f"📝 Generating call {i}/{num_calls}...")
            embedding = search_service.generate_embedding(transcript)
            
            if not embedding:
                print(f"⚠️ Warning: Failed to generate embedding for call {i}, skipping...")
                continue
            
            # Generate call data
            call_id = generate_call_id(i)
            phone_number = generate_phone_number()
            created_at = generate_random_date_in_past_month()
            updated_at = created_at + timedelta(minutes=random.randint(1, 30))
            duration = generate_duration()
            
            # Create call object
            call = Call(
                call_id=call_id,
                phone_number=phone_number,
                raw_transcript=transcript,
                transcript_embedding=embedding,
                duration_seconds=duration,
                status="completed",
                gym_id="gym_001",
                created_at=created_at,
                updated_at=updated_at
            )
            
            db.add(call)
            
            if i % 10 == 0:
                db.commit()
                print(f"✅ Committed {i} calls...")
        
        # Final commit
        db.commit()
        print(f"✅ Successfully inserted {num_calls} dummy calls!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error inserting calls: {str(e)}")
        raise
    finally:
        db.close()


def generate_anomaly_transcript(anomaly_type: str) -> Tuple[str, Optional[int], bool, Optional[str]]:
    """
    Generate transcript that will trigger anomaly detection.
    
    Anomaly types:
    - rating_conflict_high: High rating (9-10) but negative sentiment
    - rating_conflict_low: Low rating (1-2) but positive sentiment  
    - extreme_rating_high: Very high rating (10) with unusual context
    - extreme_rating_low: Very low rating (1) with unusual context
    - unusual_sentiment: Sentiment doesn't match the overall pattern
    - unusual_topics: Very different topics/pain points
    """
    transcript_parts = []
    introduction = random.choice(INTRODUCTIONS)
    transcript_parts.append(f"Alex: {introduction}")
    
    rating = None
    has_revenue_interest = False
    revenue_quote = None
    
    if anomaly_type == "rating_conflict_high":
        # High rating but negative sentiment (anomaly)
        member_response = random.choice(NEGATIVE_RESPONSES)
        rating = random.choice([9, 10])
        transcript_parts.append(f"Member: {member_response}")
        transcript_parts.append("Alex: I appreciate your feedback. Can you tell me more about the equipment?")
        transcript_parts.append("Member: Some equipment is broken and maintenance is poor. Very frustrating.")
        transcript_parts.append("Alex: I understand. How about the staff?")
        transcript_parts.append("Member: Staff could be better. Not very helpful when you need them.")
        transcript_parts.append(f"Alex: On a scale of 1 to 10, how would you rate the gym?")
        transcript_parts.append(f"Member: I'd give it a {rating}. Even with the issues, it's still the best option in the area and I've made progress here.")
        
    elif anomaly_type == "rating_conflict_low":
        # Low rating but positive sentiment (anomaly)
        member_response = random.choice(POSITIVE_RESPONSES)
        rating = random.choice([1, 2])
        transcript_parts.append(f"Member: {member_response}")
        transcript_parts.append("Alex: That's great! Tell me more about the equipment.")
        transcript_parts.append("Member: The equipment is amazing. Top of the line stuff, really well maintained.")
        transcript_parts.append("Alex: How about the trainers?")
        transcript_parts.append("Member: The trainers are excellent. Very knowledgeable and supportive.")
        transcript_parts.append(f"Alex: On a scale of 1 to 10, what rating would you give?")
        transcript_parts.append(f"Member: I'd say {rating}. I know that seems low, but I'm comparing it to my previous gym which was a world-class facility. This is good but not quite at that level.")
        
    elif anomaly_type == "extreme_rating_high":
        # Extremely high rating (10) - statistical outlier
        member_response = random.choice(POSITIVE_RESPONSES)
        rating = 10
        transcript_parts.append(f"Member: {member_response}")
        transcript_parts.append("Alex: Wonderful! What about the equipment?")
        transcript_parts.append("Member: The equipment is absolutely perfect. Everything is brand new and cutting edge.")
        transcript_parts.append("Alex: And the staff?")
        transcript_parts.append("Member: Best staff ever. They remember my name, know my goals, always checking in.")
        transcript_parts.append("Alex: How would you rate the gym overall?")
        transcript_parts.append(f"Member: A perfect {rating} out of {rating}! I've been to gyms all over the country and this is hands down the best. Nothing comes close.")
        
    elif anomaly_type == "extreme_rating_low":
        # Extremely low rating (1) - statistical outlier
        member_response = random.choice(NEGATIVE_RESPONSES)
        rating = 1
        transcript_parts.append(f"Member: {member_response}")
        transcript_parts.append("Alex: I'm sorry to hear that. What specifically about the equipment?")
        transcript_parts.append("Member: Almost everything is broken. Machines are dangerous, weights are damaged.")
        transcript_parts.append("Alex: What about the cleanliness?")
        transcript_parts.append("Member: It's disgusting. Locker rooms are filthy, equipment never gets cleaned.")
        transcript_parts.append("Alex: On a scale of 1 to 10?")
        transcript_parts.append(f"Member: {rating} out of 10. This is the worst gym I've ever been to. I'm canceling my membership tomorrow.")
        
    elif anomaly_type == "unusual_sentiment":
        # Unusual sentiment pattern - very negative but still engaged
        rating = random.choice([6, 7])  # Middle rating
        transcript_parts.append("Member: Honestly, I have major complaints but I keep coming because I need the gym.")
        transcript_parts.append("Alex: I understand. What are your main concerns?")
        transcript_parts.append("Member: The equipment is old, staff is unhelpful, place is always dirty, and it's overcrowded. But it's cheap and close to my house.")
        transcript_parts.append("Alex: How would you rate it?")
        transcript_parts.append(f"Member: Maybe a {rating}? It's frustrating but I don't have better options nearby.")
        
    elif anomaly_type == "unusual_topics":
        # Very unusual topics/pain points
        rating = random.choice([5, 6, 7])
        transcript_parts.append("Member: It's okay, I guess.")
        transcript_parts.append("Alex: Can you tell me more about your experience?")
        transcript_parts.append("Member: My main issue is the WiFi is terrible. I need to stream workout videos and it keeps buffering.")
        transcript_parts.append("Alex: I see. What about equipment or staff?")
        transcript_parts.append("Member: Also, the music they play is awful. It's all heavy metal and I prefer electronic music. And the parking lot lighting at night is too dim.")
        transcript_parts.append("Alex: How would you rate the gym?")
        transcript_parts.append(f"Member: I'd give it a {rating}. These might seem like small things but they really affect my experience.")
    
    # Closing
    transcript_parts.append("Alex: Thank you for your honest feedback. We really appreciate it.")
    transcript_parts.append("Member: Sure, no problem.")
    transcript_parts.append("Alex: Have a great day!")
    
    transcript = " ".join(transcript_parts)
    return transcript, rating, has_revenue_interest, revenue_quote


def insert_dummy_calls(num_calls: int = 100, num_anomalies: int = 20, start_index: int = 1):
    """Generate and insert dummy calls into the database"""
    db: Session = SessionLocal()
    search_service = SearchService(db)
    
    anomaly_types = [
        "rating_conflict_high", "rating_conflict_low", "extreme_rating_high", 
        "extreme_rating_low", "unusual_sentiment", "unusual_topics"
    ]
    
    try:
        total_calls = num_calls + num_anomalies
        print(f"🚀 Generating {num_calls} normal calls and {num_anomalies} anomaly calls (total: {total_calls})...")
        print(f"📝 Starting from index {start_index}")
        
        # Get existing call_ids to avoid duplicates
        existing_call_ids = {call.call_id for call in db.query(Call.call_id).filter(Call.call_id.like("call_dummy_%")).all()}
        existing_call_ids.update({call.call_id for call in db.query(Call.call_id).filter(Call.call_id.like("call_anomaly_%")).all()})
        print(f"📊 Found {len(existing_call_ids)} existing dummy calls in database")
        
        call_index = start_index
        
        # Generate normal calls
        for i in range(1, num_calls + 1):
            transcript, rating, has_revenue_interest, revenue_quote = generate_transcript(
                rating_probability=0.7,
                revenue_interest_probability=0.3,
                include_progress=True
            )
            
            print(f"📝 Generating normal call {i}/{num_calls}...")
            embedding = search_service.generate_embedding(transcript)
            
            if not embedding:
                print(f"⚠️ Warning: Failed to generate embedding for call {i}, skipping...")
                continue
            
            call_id = generate_call_id(call_index)
            
            # Check if call_id already exists (handle duplicates gracefully)
            if call_id in existing_call_ids:
                # Generate new call_id with different timestamp if duplicate
                call_id = generate_call_id(call_index)
                if call_id in existing_call_ids:
                    print(f"⚠️ Call ID conflict for index {call_index}, generating new one...")
                    call_id = f"call_dummy_{int(datetime.now().timestamp())}_{call_index:06d}_{random.randint(1000, 9999)}"
            existing_call_ids.add(call_id)
            
            phone_number = generate_phone_number()
            created_at = generate_random_date_in_past_month()
            updated_at = created_at + timedelta(minutes=random.randint(1, 30))
            duration = generate_duration()
            
            call = Call(
                call_id=call_id,
                phone_number=phone_number,
                raw_transcript=transcript,
                transcript_embedding=embedding,
                duration_seconds=duration,
                status="completed",
                gym_id="gym_001",
                created_at=created_at,
                updated_at=updated_at
            )
            
            db.add(call)
            call_index += 1
            
            if i % 10 == 0:
                db.commit()
                print(f"✅ Committed {i} normal calls...")
        
        # Generate anomaly calls
        print(f"\n🔴 Generating {num_anomalies} anomaly calls...")
        for i in range(1, num_anomalies + 1):
            anomaly_type = random.choice(anomaly_types)
            transcript, rating, has_revenue_interest, revenue_quote = generate_anomaly_transcript(anomaly_type)
            
            print(f"📝 Generating anomaly call {i}/{num_anomalies} (type: {anomaly_type})...")
            embedding = search_service.generate_embedding(transcript)
            
            if not embedding:
                print(f"⚠️ Warning: Failed to generate embedding for anomaly call {i}, skipping...")
                continue
            
            timestamp = int(datetime.now().timestamp())
            call_id = f"call_anomaly_{timestamp}_{i:03d}"
            
            # Check if call_id already exists
            if call_id in existing_call_ids:
                # Generate new call_id if duplicate
                call_id = f"call_anomaly_{timestamp}_{i:03d}_{random.randint(1000, 9999)}"
            existing_call_ids.add(call_id)
            
            phone_number = generate_phone_number()
            created_at = generate_random_date_in_past_month()
            updated_at = created_at + timedelta(minutes=random.randint(1, 30))
            duration = generate_duration()
            
            call = Call(
                call_id=call_id,
                phone_number=phone_number,
                raw_transcript=transcript,
                transcript_embedding=embedding,
                duration_seconds=duration,
                status="completed",
                gym_id="gym_001",
                created_at=created_at,
                updated_at=updated_at
            )
            
            db.add(call)
            
            if i % 5 == 0:
                db.commit()
                print(f"✅ Committed {i} anomaly calls...")
        
        # Final commit
        db.commit()
        print(f"\n✅ Successfully inserted {num_calls} normal calls and {num_anomalies} anomaly calls!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error inserting calls: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    insert_dummy_calls(num_calls=200, num_anomalies=20)

