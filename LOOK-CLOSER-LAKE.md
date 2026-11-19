# Look closer: the lake salt half, made from the real salt

Built from your own photos of Pyoor lake salt (the two jars seen from above): the crystals were
super-resolved 4× and stitched into a large seamless field, so every crystal in it is a real one.

tools/crystals/lake/
- lake-sharp.(avif|webp|png)  3600 × 2400, the razor-sharp layer for inside the loupe
- lake-soft.(avif|webp|png)   1440 × 960, the defocused layer for outside the loupe
- compare.png                 left: a real photo crop, right: the generated field
- quilt.py, s1_hi.png, s2_hi.png  the script and the super-resolved source crops

Crystal scale in lake-sharp: about 90–130 px per crystal. lake-soft is lake-sharp downscaled 2.5× and defocused,
so the two layers line up exactly (sharp = soft × 2.5).
