var closest_fruit_strategy = {
   init: false,
   fruit_locations: [],
   find_fruits: function(board) {
      for (var col_index = 0; col_index < WIDTH; col_index++) {
         var column = board[col_index];
         for (var row_index = 0; row_index < HEIGHT; row_index++) {
            if (column[row_index]) {
               this.fruit_locations.push([col_index, row_index]);
            }
         }
      }
   },
   update_fruits: function(board) {
      var acc = [];
      for (var i = 0, l = this.fruit_locations.length; i < l; i++) {
         var location = this.fruit_locations[i];
         var item = board[location[0]][location[1]];
         if (item) {
            acc.push(location);
         }
      }
      this.fruit_locations = acc;
   },
   find_closest_fruit_location: function(x, y) {
      var closest = null;
      var min_distance = Infinity;
      this.fruit_locations.forEach(function(location) {
         var distance = Math.abs(x - location[0]) + Math.abs(y - location[1]);
         if (distance <= min_distance) {
            closest = location;
            min_distance = distance;
         }
      });
      return closest;
   },
   init_or_update: function(board) {
      if (!this.init) {
         this.find_fruits(board);
         this.init = true;
      } else {
         this.update_fruits(board);
      }      
   },
   calculate_move: function(closest_fruit_location, my_location) {
      // figure out if we need to move left or right
      var x_delta = closest_fruit_location[0] - my_location[0];
      if (x_delta > 0) {
         return EAST;
      } else if (x_delta < 0) {
         return WEST;
      }
      // figure out if we need to move left or right
      var y_delta = closest_fruit_location[1] - my_location[1];
      if (y_delta > 0) {
         return SOUTH;
      } else if (y_delta < 0) {
         return NORTH;
      }
   },
   make_move: function(board) {
      var my_x = get_my_x(), my_y = get_my_y();
      if (board[my_x][my_y] > 0) {
          return TAKE;
      }
      this.init_or_update(board);
      var closest_fruit_location = this.find_closest_fruit_location(my_x, my_y);
      if (closest_fruit_location == null) {
         return PASS;
      }
      return this.calculate_move(closest_fruit_location, [my_x, my_y]);
   }
};

// initialize certain variables when there is a new game
function new_game() {
   closest_fruit_strategy.init = false;
   closest_fruit_strategy.fruit_locations = [];
}

// make a pass through the board and find all fruit locations
// board is given in column major order
/*function find_fruits(board) {
   for (var col_index = 0; col_index < WIDTH; col_index++) {
      var column = board[col_index];
      for (var row_index = 0; row_index < HEIGHT; row_index++) {
         if (column[row_index]) {
            fruit_locations.push([col_index, row_index]);
         }
      }
   }
}*/

// make a pass through the stash and keep only locations that still have fruit
/*function update_fruits(board) {
   var acc = [];
   for (var i = 0, l = fruit_locations.length; i < l; i++) {
      var location = fruit_locations[i];
      var item = board[location[0]][location[1]];
      if (item) {
         acc.push(location);
      }
   }
   fruit_locations = acc;
}*/

// given a row and column number go through the fruit stash
// and find the one closest to us using the manhattan metric
/*function find_closest_fruit_location(x, y) {
   var closest = null;
   var min_distance = Infinity;
   fruit_locations.forEach(function(location) {
      var distance = Math.abs(x - location[0]) + Math.abs(y - location[1]);
      if (distance <= min_distance) {
         closest = location;
         min_distance = distance;
      }
   });
   return closest;
}*/

// on every pass other than the ones on which we pick up fruit we need
// to update our stash of fruit locations
/*function init_or_update(board) {
   if (!init) {
      find_fruits(board);
      init = true;
   } else {
      update_fruits(board);
   }
}*/

// given our location and the location of the closest fruit
// we calculate which direction we need to travel in
/*function calculate_move(closest_fruit_location, my_location) {
   // figure out if we need to move left or right
   var x_delta = closest_fruit_location[0] - my_location[0];
   if (x_delta > 0) {
      return EAST;
   } else if (x_delta < 0) {
      return WEST;
   }
   // figure out if we need to move left or right
   var y_delta = closest_fruit_location[1] - my_location[1];
   if (y_delta > 0) {
      return SOUTH;
   } else if (y_delta < 0) {
      return NORTH;
   }
}*/

// this is where all the magic happens
function make_move() {
   return closest_fruit_strategy.make_move(get_board());
}
