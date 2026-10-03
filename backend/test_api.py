import httpx

def test_full_pipeline():
    client = httpx.Client(base_url="http://127.0.0.1:8000")
    
    # 1. Tasks
    tasks = client.get("/api/v1/tasks").json()
    print(f"1. Tasks available: {len(tasks)}")
    do_task = [t for t in tasks if t["layer"] == "DO"][0]

    # 2. Login
    login = client.post("/api/v1/auth/login", json={"identifier": "shoxrux@edu.uz", "password": "root123"}).json()
    uid = login["user"]["id"]
    print(f"2. Student logged in: {login['user']['full_name']} (ID: {uid})")

    # 3. Start Assessment
    att = client.post(f"/api/v1/tasks/attempt/start?user_id={uid}", json={"task_id": do_task["id"]}).json()
    att_id = att["attempt_id"]
    print(f"3. Assessment Attempt started: {att_id} for '{do_task['title']}'")

    # 4. Submit Sandbox Solution
    sub = client.post("/api/v1/tasks/attempt/submit", json={
        "attempt_id": att_id,
        "code_content": "def rate_limiter(request, client_ip: str) -> bool:\n    return True\n"
    }).json()
    print(f"4. Code evaluated: Score {sub['total_score']}/100, Earned {sub['earned_points']} pts, New Skill Score: {sub['new_skill_score']}")

    # 5. Start AI Viva
    viva = client.post(f"/api/v1/viva/session/start?attempt_id={att_id}").json()
    sess_id = viva["session_id"]
    print(f"5. AI Viva started: Session {sess_id}")
    print(f"   AI Examiner Question: {viva['turns'][0]['content']}")

    # 6. Student replies to AI Viva
    ans = client.post("/api/v1/viva/message", json={
        "session_id": sess_id,
        "content": "Token Bucket algoritmini tanladim, chunki u kutilmagan burst so‘rovlarni yaxshi boshqaradi, Redis kesh bilan O(1) vaqt va xotira murakkabligida ishlaydi."
    }).json()
    print(f"6. Viva response graded: Score {ans['score']}, Feedback: {ans['feedback']}")
    print(f"   Next step: {ans['reply']}")

if __name__ == "__main__":
    test_full_pipeline()
