UPDATE "User"
SET "faculty" = CASE
  WHEN "faculty" IN ('Faculty of Business & Communications', 'INTI Student • Faculty of Business & Communications', 'INTI Staff • Faculty of Business & Communications') THEN replace("faculty", 'Faculty of Business & Communications', 'Faculty of Business and Communications')
  WHEN "faculty" IN ('Faculty of Business', 'INTI Student • Faculty of Business', 'INTI Staff • Faculty of Business') THEN replace("faculty", 'Faculty of Business', 'Faculty of Business and Communications')
  WHEN "faculty" IN ('Faculty of Computing & Information Technologies', 'INTI Student • Faculty of Computing & Information Technologies', 'INTI Staff • Faculty of Computing & Information Technologies') THEN replace("faculty", 'Faculty of Computing & Information Technologies', 'Faculty of Data Science and Information Technology (FDSIT)')
  WHEN "faculty" IN ('Faculty of IT', 'INTI Student • Faculty of IT', 'INTI Staff • Faculty of IT') THEN replace("faculty", 'Faculty of IT', 'Faculty of Data Science and Information Technology (FDSIT)')
  WHEN "faculty" IN ('Faculty of Engineering & Quantitative Studies', 'INTI Student • Faculty of Engineering & Quantitative Studies', 'INTI Staff • Faculty of Engineering & Quantitative Studies') THEN replace("faculty", 'Faculty of Engineering & Quantitative Studies', 'Faculty of Engineering & Quantity Surveying')
  WHEN "faculty" IN ('Faculty of Engineering', 'INTI Student • Faculty of Engineering', 'INTI Staff • Faculty of Engineering') THEN replace("faculty", 'Faculty of Engineering', 'Faculty of Engineering & Quantity Surveying')
  WHEN "faculty" IN ('Faculty of Health & Life Sciences', 'INTI Student • Faculty of Health & Life Sciences', 'INTI Staff • Faculty of Health & Life Sciences') THEN replace("faculty", 'Faculty of Health & Life Sciences', 'Faculty of Health and Life Sciences')
  WHEN "faculty" IN ('Faculty of Science', 'INTI Student • Faculty of Science', 'INTI Staff • Faculty of Science') THEN replace("faculty", 'Faculty of Science', 'Faculty of Health and Life Sciences')
  WHEN "faculty" IN ('Faculty of Art & Design', 'INTI Student • Faculty of Art & Design', 'INTI Staff • Faculty of Art & Design') THEN replace("faculty", 'Faculty of Art & Design', 'Faculty of Education and Liberal Arts (FELA)')
  WHEN "faculty" IN ('Faculty of Art', 'INTI Student • Faculty of Art', 'INTI Staff • Faculty of Art') THEN replace("faculty", 'Faculty of Art', 'Faculty of Education and Liberal Arts (FELA)')
  ELSE "faculty"
END
WHERE "faculty" IS NOT NULL
  AND "faculty" IN (
    'Faculty of Business & Communications',
    'INTI Student • Faculty of Business & Communications',
    'INTI Staff • Faculty of Business & Communications',
    'Faculty of Business',
    'INTI Student • Faculty of Business',
    'INTI Staff • Faculty of Business',
    'Faculty of Computing & Information Technologies',
    'INTI Student • Faculty of Computing & Information Technologies',
    'INTI Staff • Faculty of Computing & Information Technologies',
    'Faculty of IT',
    'INTI Student • Faculty of IT',
    'INTI Staff • Faculty of IT',
    'Faculty of Engineering & Quantitative Studies',
    'INTI Student • Faculty of Engineering & Quantitative Studies',
    'INTI Staff • Faculty of Engineering & Quantitative Studies',
    'Faculty of Engineering',
    'INTI Student • Faculty of Engineering',
    'INTI Staff • Faculty of Engineering',
    'Faculty of Health & Life Sciences',
    'INTI Student • Faculty of Health & Life Sciences',
    'INTI Staff • Faculty of Health & Life Sciences',
    'Faculty of Science',
    'INTI Student • Faculty of Science',
    'INTI Staff • Faculty of Science',
    'Faculty of Art & Design',
    'INTI Student • Faculty of Art & Design',
    'INTI Staff • Faculty of Art & Design',
    'Faculty of Art',
    'INTI Student • Faculty of Art',
    'INTI Staff • Faculty of Art'
  );
