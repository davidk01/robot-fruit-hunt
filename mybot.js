var init;
var fruit_locations;

// initialize certain variables when there is a new game
function new_game() {
   init = false;
   fruit_locations = [];
}


// make a pass through the board and find all fruit locations
function find_fruits(board) {
   for (var i = 0; i < LENGTH; i++) {
      var row = board[i];
      for (var j = 0; j < WIDTH; j++) {
         if (row[j] || row[j] === 0) {
            fruit_locations.push([i,j]);
         }
      }
   }
}

// make a pass through the stash and keep only locations that still have fruit
function update_fruits(board) {
   var acc = [];
   for (var i = 0, l = fruit_locations.length; i < l; i++) {
      var location = fruit_locations[i];
      var item = board[location[0]][location[1]];
      if (item || item === 0) {
         acc.push(location);
      }
   }
   fruit_locations = acc;
}

// given a row and column number go through the fruit stash
// and find the one closest to us using the manhattan metric
function find_closest_fruit_location(row, column) {
   var closest = null;
   var min_distance = Infinity;
   fruit_locations.forEach(function(location) {
      var distance = Math.abs(row - location[0]) + Math.abs(column - location[1]);
      if (distance <= min_distance) {
         closest = location;
         min_distance = distance;
      }
   });
   return closest;
}

// on every pass other than the ones on which we pick up fruit we need
// to update our stash of fruit locations
function init_or_update(board) {
   if (!init) {
      find_fruits(board);
      init = true;
   } else {
      update_fruits(board);
   }
}

// given our location and the location of the closest fruit
// we calculate which direction we need to travel in
function calculate_move(closest_fruit_location, my_location) {
   // figure out if we need to move up or down a row
   var row_delta = closest_fruit_location[0] - my_location[0];
   if (row_delta > 0) {
      return NORTH;
   } else if (row_delta < 0) {
      return SOUTH;
   }
   // figure out if we need to move left or right
   var column_delta = closest_fruit_location[1] - my_location[1];
   if (column_delta > 0) {
      return EAST;
   } else if (column_delta < 0) {
      return WEST;
   }
}

function make_move() {
   var board = get_board();
   var my_x = get_my_x(), my_y = get_my_y();
   if (board[my_x][my_y] > 0) {
       return TAKE;
   }
   init_or_update(board);
   var closest_fruit_location = find_closest_fruit_location(my_x, my_y);
   if (closest_fruit_location == null) {
      return PASS;
   }
   return calculate_move(closest_fruit_location, [my_x, my_y]);
}
