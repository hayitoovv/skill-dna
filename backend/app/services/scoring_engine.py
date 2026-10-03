from typing import Dict, Tuple

LAYER_WEIGHTS = {
    "KNOW": 0.15,
    "DO": 0.30,
    "ADAPT": 0.20,
    "DEFEND": 0.20,
    "PROVE": 0.15,
}

def calculate_skill_score(components: Dict[str, float]) -> Tuple[float, float, str]:
    """
    Calculates Skill Score (0-100), Confidence Score (0-100%), and Skill Level (L1-L5)
    based on the 5-layer architecture from Section 6 of SKILL DNA architecture specification.
    """
    total_score = 0.0
    evidence_count = 0

    for layer, weight in LAYER_WEIGHTS.items():
        layer_score = components.get(layer, 0.0)
        total_score += layer_score * weight
        if layer_score > 0:
            evidence_count += 1

    # Confidence score: based on coverage of evidence across all 5 layers
    # Max confidence is 100% when all 5 layers have substantiated evidence
    confidence = min(100.0, (evidence_count / 5.0) * 85.0 + (total_score / 100.0) * 15.0)

    # Level gating: Score != Level (High score alone does not grant Master)
    score = round(total_score, 1)
    confidence = round(confidence, 1)

    has_know = components.get("KNOW", 0) >= 60
    has_do = components.get("DO", 0) >= 65
    has_adapt = components.get("ADAPT", 0) >= 70
    has_defend = components.get("DEFEND", 0) >= 70
    has_prove = components.get("PROVE", 0) >= 75

    if score >= 90 and has_know and has_do and has_adapt and has_defend and has_prove and confidence >= 85:
        level = "L5 MASTER"
    elif score >= 82 and has_know and has_do and has_adapt and has_defend:
        level = "L4 CREATE"
    elif score >= 70 and has_know and has_do:
        level = "L3 ANALYZE"
    elif score >= 55 and has_know:
        level = "L2 APPLY"
    else:
        level = "L1 UNDERSTAND"

    return score, confidence, level
