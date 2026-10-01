import os

from flask import Flask, render_template, request, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector

# Experta
from experta import KnowledgeEngine, Rule, Fact, P

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/static"
)

app.secret_key = "fruit-memory-ai-secret-key"

TOTAL_LEVELS = 10


DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", "Rahmat@123"),
    "database": os.environ.get("DB_NAME", "fruit_memory_ai"),
}


def get_db():
    return mysql.connector.connect(**DB_CONFIG)
class StudentPerformance(Fact):
    """
    Stores the student's accuracy.
    """
    pass


class MemoryExpert(KnowledgeEngine):

    # Rule 1: Excellent performance
    @Rule(StudentPerformance(accuracy=P(lambda x: x >= 85)))
    def excellent_performance(self):
        self.result = "Great memory! Continue to the next level."

    # Rule 2: Good performance
    @Rule(
        StudentPerformance(
            accuracy=P(lambda x: 60 <= x < 85)
        )
    )
    def good_performance(self):
        self.result = "Good progress! Keep practicing."

    # Rule 3: Low performance
    @Rule(StudentPerformance(accuracy=P(lambda x: x < 60)))
    def low_performance(self):
        self.result = "Practice this level again."


def ai_recommendation(accuracy):
    """
    Runs the Experta rule-based expert system.
    """

    engine = MemoryExpert()

    # Reset the expert system
    engine.reset()

    # Give accuracy as a fact
    engine.declare(
        StudentPerformance(accuracy=accuracy)
    )

    # Run the rules
    engine.run()

    return engine.result

@app.route("/")
def home():
    return render_template(
        "index.html",
        total_levels=TOTAL_LEVELS
    )


@app.route("/api/signup", methods=["POST"])
def signup():

    try:
        data = request.get_json() or {}

        name = (data.get("name") or "").strip()
        user_id = (data.get("user_id") or "").strip()
        password = data.get("password") or ""

        if not name or not user_id or not password:
            return jsonify({
                "ok": False,
                "message": "Please fill in every field."
            })

        password_hash = generate_password_hash(password)

        db = get_db()
        cursor = db.cursor()

        try:

            cursor.execute(
                """
                INSERT INTO users
                (name, user_id, password_hash)
                VALUES (%s, %s, %s)
                """,
                (
                    name,
                    user_id,
                    password_hash
                )
            )

            # Unlock first level
            cursor.execute(
                """
                INSERT INTO progress
                (user_id, level, unlocked, completed)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    user_id,
                    1,
                    1,
                    0
                )
            )

            db.commit()

            return jsonify({
                "ok": True,
                "message": "Account created! Please sign in."
            })

        except mysql.connector.IntegrityError:

            db.rollback()

            return jsonify({
                "ok": False,
                "message": "That User ID is already taken."
            })

        finally:

            cursor.close()
            db.close()

    except Exception as e:

        print("Signup error:", e)

        return jsonify({
            "ok": False,
            "message": "Something went wrong during signup."
        }), 500

@app.route("/api/login", methods=["POST"])
def login():

    try:

        data = request.get_json() or {}

        user_id = (data.get("user_id") or "").strip()
        password = data.get("password") or ""

        if not user_id or not password:
            return jsonify({
                "ok": False,
                "message": "Please enter User ID and password."
            })

        db = get_db()

        cursor = db.cursor(
            dictionary=True
        )

        try:

            cursor.execute(
                """
                SELECT *
                FROM users
                WHERE user_id = %s
                """,
                (user_id,)
            )

            user = cursor.fetchone()

        finally:

            cursor.close()
            db.close()

        if (
            not user
            or not check_password_hash(
                user["password_hash"],
                password
            )
        ):
            return jsonify({
                "ok": False,
                "message": "Wrong User ID or password."
            })

        # Store login information
        session["user_id"] = user["user_id"]
        session["name"] = user["name"]

        return jsonify({
            "ok": True,
            "name": user["name"],
            "user_id": user["user_id"]
        })

    except Exception as e:

        print("Login error:", e)

        return jsonify({
            "ok": False,
            "message": "Something went wrong during login."
        }), 500

@app.route("/api/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({
        "ok": True
    })
@app.route("/api/progress")
def get_progress():

    if "user_id" not in session:

        return jsonify({
            "ok": False,
            "message": "Please sign in."
        }), 401

    user_id = session["user_id"]

    try:

        db = get_db()

        cursor = db.cursor(
            dictionary=True
        )

        try:

            cursor.execute(
                """
                SELECT
                    level,
                    unlocked,
                    completed,
                    best_score,
                    best_moves,
                    best_time
                FROM progress
                WHERE user_id = %s
                ORDER BY level
                """,
                (user_id,)
            )

            rows = cursor.fetchall()

        finally:

            cursor.close()
            db.close()

        progress_by_level = {
            row["level"]: row
            for row in rows
        }

        levels = []

        for level in range(
            1,
            TOTAL_LEVELS + 1
        ):

            row = progress_by_level.get(
                level,
                {
                    "level": level,
                    "unlocked": 0,
                    "completed": 0,
                    "best_score": 0,
                    "best_moves": 0,
                    "best_time": 0
                }
            )

            levels.append(row)

        return jsonify({
            "ok": True,
            "levels": levels,
            "total_levels": TOTAL_LEVELS
        })

    except Exception as e:

        print("Progress error:", e)

        return jsonify({
            "ok": False,
            "message": "Could not load level progress."
        }), 500


# =========================================================
# SAVE GAME RESULT
# =========================================================

@app.route("/api/save_result", methods=["POST"])
def save_result():

    if "user_id" not in session:

        return jsonify({
            "ok": False,
            "message": "Please sign in."
        }), 401

    try:

        user_id = session["user_id"]

        data = request.get_json() or {}

        level = int(
            data.get("level", 1)
        )

        moves = int(
            data.get("moves", 0)
        )

        time_seconds = int(
            data.get("time_seconds", 0)
        )

        correct_pairs = int(
            data.get("correct_pairs", 0)
        )

        total_attempts = int(
            data.get("total_attempts", 1)
        )

        score = int(
            data.get("score", 0)
        )

        # Prevent division by zero
        if total_attempts <= 0:
            total_attempts = 1

        # Calculate accuracy
        accuracy = round(
            (correct_pairs / total_attempts) * 100,
            1
        )

        # =================================================
        # EXPERTA
        # =================================================

        recommendation = ai_recommendation(
            accuracy
        )

        # =================================================
        # DATABASE
        # =================================================

        db = get_db()

        cursor = db.cursor(
            dictionary=True
        )

        try:

            # Save result
            cursor.execute(
                """
                INSERT INTO results
                (
                    user_id,
                    level,
                    score,
                    moves,
                    time_seconds,
                    accuracy
                )
                VALUES
                (%s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    level,
                    score,
                    moves,
                    time_seconds,
                    accuracy
                )
            )

            # Check existing progress
            cursor.execute(
                """
                SELECT *
                FROM progress
                WHERE user_id = %s
                AND level = %s
                """,
                (
                    user_id,
                    level
                )
            )

            existing = cursor.fetchone()

            if existing:

                old_score = (
                    existing["best_score"]
                    or 0
                )

                old_moves = (
                    existing["best_moves"]
                    or 0
                )

                old_time = (
                    existing["best_time"]
                    or 0
                )

                best_score = max(
                    old_score,
                    score
                )

                best_moves = (
                    min(old_moves, moves)
                    if old_moves > 0
                    else moves
                )

                best_time = (
                    min(old_time, time_seconds)
                    if old_time > 0
                    else time_seconds
                )

                cursor.execute(
                    """
                    UPDATE progress
                    SET
                        completed = 1,
                        unlocked = 1,
                        best_score = %s,
                        best_moves = %s,
                        best_time = %s
                    WHERE user_id = %s
                    AND level = %s
                    """,
                    (
                        best_score,
                        best_moves,
                        best_time,
                        user_id,
                        level
                    )
                )
            else:

                cursor.execute(
                    """
                    INSERT INTO progress
                    (
                        user_id,
                        level,
                        unlocked,
                        completed,
                        best_score,
                        best_moves,
                        best_time
                    )
                    VALUES
                    (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        level,
                        1,
                        1,
                        score,
                        moves,
                        time_seconds
                    )
                )

            unlocked_next = False

            next_level = level + 1

            if next_level <= TOTAL_LEVELS:

                cursor.execute(
                    """
                    SELECT *
                    FROM progress
                    WHERE user_id = %s
                    AND level = %s
                    """,
                    (
                        user_id,
                        next_level
                    )
                )

                next_row = cursor.fetchone()

                # Next level doesn't exist
                if not next_row:

                    cursor.execute(
                        """
                        INSERT INTO progress
                        (
                            user_id,
                            level,
                            unlocked,
                            completed
                        )
                        VALUES
                        (%s, %s, %s, %s)
                        """,
                        (
                            user_id,
                            next_level,
                            1,
                            0
                        )
                    )

                    unlocked_next = True

                # Next level exists but locked
                elif not next_row["unlocked"]:

                    cursor.execute(
                        """
                        UPDATE progress
                        SET unlocked = 1
                        WHERE user_id = %s
                        AND level = %s
                        """,
                        (
                            user_id,
                            next_level
                        )
                    )

                    unlocked_next = True

            db.commit()

        except Exception:

            db.rollback()

            raise

        finally:

            cursor.close()
            db.close()


        return jsonify({
            "ok": True,
            "accuracy": accuracy,
            "recommendation": recommendation,
            "unlocked_next": unlocked_next,
            "next_level": (
                next_level
                if next_level <= TOTAL_LEVELS
                else None
            )
        })

    except Exception as e:

        print(
            "Save result error:",
            e
        )

        return jsonify({
            "ok": False,
            "message": "Something went wrong while saving result."
        }), 500

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
