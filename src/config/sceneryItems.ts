import type { SceneryItem } from './sceneryTypes';

// Двір UniMap: доріжки/фонтан/будівля/газони/дерева/кущі/лавки — все редаговане
// через "🏗 Двір/будівлі" в адмін-панелі (перетягування, колір, розмір, поворот, видалення).
export const sceneryItems: SceneryItem[] = [
  {
    "id": "path_w1a",
    "kind": "path",
    "x": 911,
    "y": 1413,
    "width": 333,
    "height": 46,
    "rotation": -11.79,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w1b",
    "kind": "path",
    "x": 1221,
    "y": 1305,
    "width": 285,
    "height": 46,
    "rotation": -31.07,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w2",
    "kind": "path",
    "x": 785,
    "y": 1974,
    "width": 1616,
    "height": 52,
    "rotation": 33,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w3a",
    "kind": "path",
    "x": 1944,
    "y": 1160,
    "width": 283,
    "height": 42,
    "rotation": -5.84,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w3b_",
    "kind": "path",
    "x": 2226,
    "y": 1137,
    "width": 175,
    "height": 42,
    "rotation": -5.34,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w3b1",
    "kind": "path",
    "x": 2260,
    "y": 904,
    "width": 501,
    "height": 42,
    "rotation": -63.95,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w3b2",
    "kind": "path",
    "x": 2603,
    "y": 662,
    "width": 35,
    "height": 42,
    "rotation": -90,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w4a",
    "kind": "path",
    "x": 1857,
    "y": 1680,
    "width": 1100,
    "height": 40,
    "rotation": 89.22,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w4b",
    "kind": "path",
    "x": 2326,
    "y": 2304,
    "width": 151,
    "height": 40,
    "rotation": 100.38,
    "color": "#e9e2d0"
  },
  {
    "id": "path_w4c",
    "kind": "path",
    "x": 2291,
    "y": 2432,
    "width": 126,
    "height": 40,
    "rotation": 122.52,
    "color": "#e9e2d0"
  },
  {
    "id": "fountain_main",
    "kind": "fountain",
    "x": 1720,
    "y": 1240,
    "width": 300,
    "height": 300,
    "rotation": 0
  },
  {
    "id": "building_new",
    "kind": "building",
    "x": 1950,
    "y": 470,
    "width": 920,
    "height": 190,
    "rotation": 0,
    "color": "#fcfcfa",
    "label": "",
    "dividers": 2
  },
  {
    "id": "lawn_top",
    "kind": "lawn",
    "x": 840,
    "y": 170,
    "width": 1030,
    "height": 400,
    "rotation": 0,
    "color": "#e4efe1"
  },
  {
    "id": "lawn_bottom",
    "kind": "lawn",
    "x": 1740,
    "y": 2600,
    "width": 340,
    "height": 220,
    "rotation": 0,
    "color": "#e4efe1"
  },
  {
    "id": "lawn_main",
    "kind": "lawn",
    "x": 960,
    "y": 700,
    "width": 1520,
    "height": 1530,
    "rotation": 0,
    "color": "#e4efe1",
    "shape": [
      {
        "rx": 0.0263,
        "ry": 0.0654
      },
      {
        "rx": 0.0789,
        "ry": 0,
        "rcx": 0.0132,
        "rcy": 0.0131
      },
      {
        "rx": 0.9342,
        "ry": 0
      },
      {
        "rx": 0.9934,
        "ry": 0.0654,
        "rcx": 1,
        "rcy": 0
      },
      {
        "rx": 0.9934,
        "ry": 0.9346
      },
      {
        "rx": 0.9342,
        "ry": 0.9869,
        "rcx": 0.9934,
        "rcy": 1
      },
      {
        "rx": 0.9013,
        "ry": 0.9739
      },
      {
        "rx": 0.0329,
        "ry": 0.6536
      },
      {
        "rx": 0.0066,
        "ry": 0.5882,
        "rcx": 0,
        "rcy": 0.6405
      }
    ]
  },
  {
    "id": "lawn_garden",
    "kind": "lawn",
    "x": 940,
    "y": 1990,
    "width": 720,
    "height": 620,
    "rotation": 0,
    "color": "#e4efe1",
    "shape": [
      {
        "rx": 0.0972,
        "ry": 0.1452
      },
      {
        "rx": 0.6667,
        "ry": 0.0645,
        "rcx": 0.3333,
        "rcy": 0
      },
      {
        "rx": 0.9861,
        "ry": 0.4677,
        "rcx": 1,
        "rcy": 0.129
      },
      {
        "rx": 0.6389,
        "ry": 0.9194,
        "rcx": 0.9722,
        "rcy": 0.8226
      },
      {
        "rx": 0.125,
        "ry": 0.7742,
        "rcx": 0.2917,
        "rcy": 1
      },
      {
        "rx": 0.0972,
        "ry": 0.1452,
        "rcx": 0,
        "rcy": 0.5484
      }
    ]
  },
  {
    "id": "tree_0",
    "kind": "tree",
    "x": 1245,
    "y": 1105,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_1",
    "kind": "tree",
    "x": 1420,
    "y": 940,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_2",
    "kind": "tree",
    "x": 2080,
    "y": 940,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_3",
    "kind": "tree",
    "x": 2240,
    "y": 1660,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_4",
    "kind": "tree",
    "x": 1330,
    "y": 1730,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_5",
    "kind": "tree",
    "x": 2430,
    "y": 1550,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_6",
    "kind": "tree",
    "x": 1150,
    "y": 1300,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_7",
    "kind": "tree",
    "x": 1900,
    "y": 1850,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_8",
    "kind": "tree",
    "x": 960,
    "y": 310,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_9",
    "kind": "tree",
    "x": 1290,
    "y": 440,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_10",
    "kind": "tree",
    "x": 1660,
    "y": 300,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_11",
    "kind": "tree",
    "x": 1120,
    "y": 2200,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_12",
    "kind": "tree",
    "x": 1360,
    "y": 2160,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_13",
    "kind": "tree",
    "x": 1500,
    "y": 2360,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_14",
    "kind": "tree",
    "x": 1230,
    "y": 2440,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_15",
    "kind": "tree",
    "x": 1850,
    "y": 2700,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "tree_16",
    "kind": "tree",
    "x": 1990,
    "y": 2740,
    "width": 76,
    "height": 76,
    "rotation": 0,
    "color": "#8fbf93"
  },
  {
    "id": "bush_0",
    "kind": "bush",
    "x": 1530,
    "y": 1050,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_1",
    "kind": "bush",
    "x": 1930,
    "y": 1060,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_2",
    "kind": "bush",
    "x": 2150,
    "y": 1300,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_3",
    "kind": "bush",
    "x": 1450,
    "y": 1560,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_4",
    "kind": "bush",
    "x": 1860,
    "y": 1740,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_5",
    "kind": "bush",
    "x": 1080,
    "y": 360,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_6",
    "kind": "bush",
    "x": 1300,
    "y": 2300,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_7",
    "kind": "bush",
    "x": 1450,
    "y": 2200,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bush_8",
    "kind": "bush",
    "x": 1930,
    "y": 2680,
    "width": 44,
    "height": 44,
    "rotation": 0,
    "color": "#a8cf9f"
  },
  {
    "id": "bench_0",
    "kind": "bench",
    "x": 1526,
    "y": 1121,
    "width": 68,
    "height": 18,
    "rotation": -20,
    "color": "#d8b98a"
  },
  {
    "id": "bench_1",
    "kind": "bench",
    "x": 1866,
    "y": 1151,
    "width": 68,
    "height": 18,
    "rotation": 25,
    "color": "#d8b98a"
  },
  {
    "id": "bench_2",
    "kind": "bench",
    "x": 1551,
    "y": 1391,
    "width": 68,
    "height": 18,
    "rotation": 205,
    "color": "#d8b98a"
  },
  {
    "id": "bench_3",
    "kind": "bench",
    "x": 1871,
    "y": 1361,
    "width": 68,
    "height": 18,
    "rotation": 155,
    "color": "#d8b98a"
  }
];
