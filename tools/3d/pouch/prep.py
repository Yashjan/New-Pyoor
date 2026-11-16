import numpy as np
from PIL import Image
from scipy import ndimage as ndi
Image.MAX_IMAGE_PIXELS=None

def white_boxes(a):
    """Find white rectangles in the lower right of the back panel."""
    g=a.mean(2); h,w=g.shape
    white=g>235
    reg=white[int(h*0.7):, int(w*0.5):]
    lab,n=ndi.label(reg)
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab)):
        ys,xs=sl
        bh,bw=ys.stop-ys.start, xs.stop-xs.start
        if bw>w*0.25 and bh>h*0.04:
            out.append((ys.start+int(h*0.7), ys.stop+int(h*0.7), xs.start+int(w*0.5), xs.stop+int(w*0.5)))
    return sorted(out)

def period_y(a, x0, x1, y0, y1):
    g=a[y0:y1, x0:x1].mean(2).mean(1); g=g-g.mean()
    ac=np.correlate(g,g,'full')[len(g)-1:]
    ac/=ac[0]
    lo=40
    return lo+int(np.argmax(ac[lo:len(g)//2]))

def remove_barcode(src, dst):
    a=np.asarray(Image.open(src).convert('RGB')).copy()
    boxes=white_boxes(a)
    print('white boxes', boxes)
    y0,y1,x0,x1=boxes[-1]          # the lowest box = barcode
    pad=6; y0-=pad; y1+=pad; x0-=pad; x1+=pad
    p=period_y(a, x0, x1, 0, 900)
    # copy from the top pattern area, shifted by a whole number of periods
    k=int(np.ceil((y0-60)/p)); sy=y0-k*p
    while sy<0: sy+=p
    patch=a[sy:sy+(y1-y0), x0:x1]
    a[y0:y1, x0:x1]=patch
    Image.fromarray(a).save(dst)
    print(src,'barcode box',(x0,y0,x1,y1),'period',p,'src y',sy)

def window_mask(src, dst):
    a=np.asarray(Image.open(src).convert('RGB')).astype(int)
    h,w,_=a.shape
    light=(a.min(2)>215)&((a.max(2)-a.min(2))<18)
    light[:int(h*0.5)]=False
    lab,n=ndi.label(light)
    sizes=ndi.sum(light,lab,range(1,n+1))
    m=(lab==(1+int(np.argmax(sizes))))
    m=ndi.binary_closing(m,iterations=6); m=ndi.binary_fill_holes(m)
    img=Image.fromarray((m*255).astype(np.uint8))
    img.save(dst); print(dst,'window px',m.sum(), 'bbox', ndi.find_objects(m.astype(int))[0])

for k in ['black','lake']:
    remove_barcode(f'{k}_back_raw.png', f'{k}_back.png')
    window_mask(f'{k}_front_raw.png', f'{k}_window.png')
