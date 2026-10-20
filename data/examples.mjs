export const examples={
 'p-data':`import java.util.Scanner;
public class Digits {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    int n = sc.nextInt();
    if (n < 100 || n > 999) {
      System.out.println("请输入三位正整数");
      return;
    }
    System.out.printf("%d %d %d%n", n % 10, n / 10 % 10, n / 100);
  }
}`,
 'p-flow':`// 新编示例：5行递增星号
for (int i = 1; i <= 5; i++) {
  for (int j = 1; j <= i; j++) {
    System.out.print("*");
  }
  System.out.println();
}`,
 'p-ops':`// 第10天吃前剩1个，回推9次
int peaches = 1;
for (int day = 9; day >= 1; day--) {
  peaches = 2 * (peaches + 1);
}
System.out.println(peaches); // 1534`,
 'p-array':`int[] a = {10, 20, 30};
a[1] = 99;
int[] b = new int[a.length];
for (int i = 0; i < a.length; i++) {
  b[i] = a[i]; // 复制基本类型元素
}
System.out.println("12345".substring(1, 4)); // 234`,
 'p-class':`class Student {
  private String name;
  private int age;
  public Student(String name, int age) {
    this.name = name;
    setAge(age);
  }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public int getAge() { return age; }
  public void setAge(int age) {
    if (age < 0) throw new IllegalArgumentException("年龄不能为负");
    this.age = age;
  }
}`,
 'p-oop':`abstract class Shape {
  public abstract double area();
}
class Rectangle extends Shape {
  private final double width, height;
  public Rectangle(double w, double h) {
    if (w <= 0 || h <= 0) throw new IllegalArgumentException();
    width = w; height = h;
  }
  @Override public double area() { return width * height; }
}
// 在main中：Shape s = new Rectangle(3, 4);
// System.out.println(s.area()); // 12.0`,
 'p-abstract':`interface Startable {
  void start();
}
class Pump implements Startable {
  @Override public void start() {
    System.out.println("启动水泵");
  }
}
// Startable device = new Pump();
// device.start();`
};
