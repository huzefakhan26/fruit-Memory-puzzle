🍓 Fruit Memory AI Puzzle

A memory-matching game where you flip fruit cards to find pairs. 
A cartoon cat guides you through a train-shaped level map, and 
after every level an AI Memory Coach looks at how you played and tells you whether to move on or practise again.

Built with HTML, CSS, JavaScript, Flask and MySQL.

The AI in this project is a rule-based system (also called an expert system or a production-rule system.
 * The 3-Step Process:
 1) Perception (Data Collection): 
  While playing, the game tracks player performance metrics such as correct pairs matched, 
  total attempts, total moves, and time taken.
2) Reasoning (Calculation):
   When a level ends, the backend calculates the player's accuracy percentage .
3)Decision Making (IF-THEN Rules):
  The accuracy score is evaluated using a set of clear production rules:
   Rule 1 ($\ge 85\%$): "Great memory! Continue to the next level".
   Rule 2 ($60\% - 84\%$): "Good progress! Keep practicing".
   Rule 3 ($< 60\%$): "Practice this level again."
    
     
  
