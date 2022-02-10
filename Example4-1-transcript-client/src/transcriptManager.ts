// manage the transcript database

export type StudentID = number;
export type Student = { studentID: number, studentName: string };
export type Course = string;
export type CourseGrade = { course: Course, grade: number };
export type Transcript = { student: Student, grades: CourseGrade[] };