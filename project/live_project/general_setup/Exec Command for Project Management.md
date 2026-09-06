***
Baik windows maupun linux dapat beroperasi melalui terminal, tidak hanya mengandalkan UI yang perlu dijalankan dengan extra peripherals seperti mouse. Dengan terminal, aksesibilitas menjadi lebih cepat dan membiasakan nerves untuk melakukan pekerjaan teknis dalam development.

Yang sedang aku build adalah sebuah basic command untuk membuka direktori project yang sedang kugarap beserta aplikasi-aplikasi lingkungan developmentnya. 

Seperti misal, aku sedang mengembangkan sebuah aplikasi portal yang menggunakan React sebagai framework utama. Otomatis aku akan melakukan run atau host secara local dengan command "npm run dev". Aku juga lebih prefer untuk memantau version control melalui terminal di window yang lain, belum lagi aku perlu membuka Visual Studio code sebagai code editor. Terhitung minimal terdapat 3 proses yang perlu kujalankan secara sequensial namun jika aku hanya perlu mengetik keyword projectku di terminal dalam direktori manapun, aku dapat membuka seluruh direktori sekaligus dalam 2 detik tanpa berpindah windows.

Berikut adalah contoh isi file .bat yang kumiliki pada kasus tersebut.

`start cmd /k "cd /d C:\Users\Karinda\Documents\Monolith"
`code C:\Users\Karinda\Documents\Monolith`
`npm run dev`
