import java.io.*;
import java.util.*;

/*
  Build a LDR Pyramid:

  0 Name: pyramidX.ldr
  0 Author: BuildPyramid.java
  0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
  1 0 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat
  0 STEP
  ...

 */
public class BuildPyramid {
    public static final int DX = 40, DY = -24;

    public static void printUsage() {
        System.out.println("This program creates an LDraw sample file. Please specify a single argument being an integer for maximal size length in number of 2x2 bricks.");
    }

    public static void main(String[] args) throws IOException {
        if(args.length != 1) {
            printUsage();
            return;
        }
        int size = Integer.parseInt(args[0]);

        // Find valid colors:
        List<Integer> validColors = new ArrayList<Integer>();
        Scanner s = new Scanner(new File("../js/colors.js")).useDelimiter("[\\[\\]]");
        s.nextLine(); // ' use strict'
        s.nextLine(); // Comment
        s.nextLine(); // var LDR
        while(s.hasNextLine()) {
            s.next();
            if(!s.hasNextInt())
                break;
            int color = s.nextInt();
            validColors.add(color);
        }
        s.close();

        // Write LDR file:
        String f = "pyramid" + size + ".ldr";
        PrintWriter w = new PrintWriter(new File(f));
        w.println("0 Name: " + f);
        w.println("0 Author: BuildPyramid.java");
        w.println("0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt");

        int colorIndex = 0;
        for(int i = 0; i < size; i++) {
            int width = size-i;
            for(int x = 0; x < width; x++) {
                for(int z = 0; z < width; z++) {
                    w.println("1 " + validColors.get(colorIndex++) + " " + (x*DX-width*DX/2) + " " + (i*DY) + " " + (z*DX-width*DX/2) + " 1 0 0 0 1 0 0 0 1 3003.dat");
                    if(colorIndex >= validColors.size())
                        colorIndex = 0;
                }
            }
            if(i == 0)
                w.println("0 STEP");
            else
                w.println("0 ROTSTEP 0 90 0 ADD");
        }
        w.flush();
        w.close();
        System.out.println("Written file " + f);
    }
}