***
There are multiple entities rooting to differences products
***
**Event Mapping & Animals Classifier**
1. Exotic Tropical
2. Exotic Desert
3. Exotic Tundra
4. Exotic Swamp
5. Halloween
6. Extinct
7. Stone Age
8. Mythical
9. Oriental
10. 

**Entity Items**
1. [Avi, Eggs] Chicken
2. Pig
3. [Ungulate, Trans] Horse, Donkey, Buffalo
4. [Ungulate, Milk] Goat, Cow, Sheep
5. [Ungulate, Furry] Sheep

**Production Items**
1. 

**Master Code**
*How to define & practice*:
1. Define states
2. Define entities
3. Define attributes
4. Define actions (including its rules and scope)
5. 
```
using System;
using System.Collections.Generic;
using System.Linq;
using Parkir.Enums;

namespace Parkir.Models {
    public class LotParkir {
        private List<Slot> slots;
        
        public LotParkir(int kapasitas)
        {
            slots = Enumerable.Range(1, kapasitas)
            .Select(i => new Slot(i))
            .ToList();
        }

        public int? ParkIn(Kendaraan kendaraan)
        {
            var space = slots.FirstOrDefault(s => s.IsFree);
            if (space == null) return null;

            space.ParkIn(kendaraan);
            return space.Nomor;
        }

        public bool Leave(int nomorSlot, out double tarif)
        {
            tarif = 0;
            var slot = slots.FirstOrDefault(s => s.Nomor == nomorSlot);
            if (slot == null || slot.IsFree) return false;

            var v = slot.Terdaftar!;
            var jam = Math.Ceiling((DateTime.Now - v.WaktuReg).TotalHours);
            if (jam < 1) jam = 1;

            const double tarifPerJam = 2000;
            tarif = jam * tarifPerJam;

            slot.Leave();
            return true;
        }

        public void CetakStatus()
        {
            Console.WriteLine("Slot No.  |  Type  |  Registration No  |  Colour");
            foreach (var s in slots.Where(x => !x.IsFree))
            {
                var v = s.Terdaftar!;
                Console.WriteLine($"{s.Nomor} | {v.Reg} | {v.Tipe} | {v.Warna}");
            }
        }

        public int typeOfVehicles(TipeKendaraan tipe) =>
            slots.Count(s => !s.IsFree && s.Terdaftar!.Tipe == tipe);

        public List<string> registrationNumbersForVehiclesColor(string warna) =>
            slots.Where(s => !s.IsFree && s.Terdaftar!.Warna.Equals(warna, StringComparison.OrdinalIgnoreCase))
            .Select(s => s.Terdaftar!.Reg)
            .ToList();

        public List<int> SlotNumberForVehicleColor(string warna) =>
            slots.Where(s => !s.IsFree && s.Terdaftar!.Warna.Equals(warna, StringComparison.OrdinalIgnoreCase))
            .Select(s => s.Nomor)
            .ToList();

        public int? SlotNumberForRegistrationNo(string plat) =>
            slots.FirstOrDefault(s => !s.IsFree && s.Terdaftar!.Reg.Equals(plat, StringComparison.OrdinalIgnoreCase))
            ?.Nomor;

        public List<string> oddEvenRegistrationNo(string mode)
        {
            bool Sesuai(int n) => (mode == "odd" && n % 2 != 0) || (mode == "even" && n % 2 == 0);

            return slots.Where(s => !s.IsFree)
                        .Select(s => s.Terdaftar!.Reg)
                        .Where(reg =>
                        {
                            var angka = new string(reg.Where(char.IsDigit).ToArray());
                            if (int.TryParse(angka, out var num))
                                return Sesuai(num);
                            return false;
                        })
                        .ToList();
        }
    }
}
```
